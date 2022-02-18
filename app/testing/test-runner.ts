import * as core from "@previewjs/core";
import { init } from "@previewjs/loader";
import assertNever from "assert-never";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import playwright from "playwright";
import { inspect } from "util";
import { AppController } from "./helpers/app-controller";
import { sync } from "./helpers/sync";
import { TestCase, TestSuite } from "./test-case";

const DEFAULT_PAGE_TIMEOUT_MILLIS = 60 * 1000;
const TEST_CASE_TIMEOUT_MILLIS = 120 * 1000;

export async function runTests({
  browser,
  setupEnvironment,
  testSuites,
  filters,
  outputDirPath,
  port,
}: {
  browser: playwright.Browser;
  setupEnvironment: core.SetupPreviewEnvironment;
  testSuites: TestSuite[];
  filters: string[];
  outputDirPath: string;
  port: number;
}) {
  const matchesAtLeastOneFilter = (
    testSuiteDescription: string,
    testCaseDescription: string
  ) => {
    if (filters.length === 0) {
      return true;
    }
    for (const filter of filters) {
      const [filterTestSuite, filterTestCase] = filter.split(":");
      if (
        filterTestSuite !== undefined &&
        testSuiteDescription.includes(filterTestSuite) &&
        (!filterTestCase || testCaseDescription.includes(filterTestCase))
      ) {
        return true;
      }
    }
    return false;
  };
  const testRunner = new TestRunner(
    browser,
    setupEnvironment,
    outputDirPath,
    port
  );
  let testCasesCount = 0;
  const failedTests: string[] = [];
  for (const testSuite of await testSuites) {
    testSuite.testCases = testSuite.testCases.filter((testCase) =>
      matchesAtLeastOneFilter(testSuite.description, testCase.description)
    );
    if (testSuite.testCases.length === 0) {
      continue;
    }
    const { count, failedTestCases } = await testRunner.runTestSuite(testSuite);
    testCasesCount += count;
    if (failedTestCases.length > 0) {
      failedTests.push(
        ...failedTestCases.map((name) => `${testSuite.description} - ${name}`)
      );
    }
  }
  return {
    testCasesCount,
    failedTests,
  };
}

class TestRunner {
  constructor(
    private readonly browser: playwright.Browser,
    private readonly setupEnvironment: core.SetupPreviewEnvironment,
    private readonly outputDirPath: string,
    private readonly port: number
  ) {}

  async runTestSuite(testSuite: TestSuite) {
    console.log(chalk.magenta(`📚 Test suite: ${testSuite.description}`));
    let count = 0;
    const failedTestCases: string[] = [];
    for (const testCase of testSuite.testCases) {
      count += 1;
      const success = await this.runTestCase(testSuite, testCase, this.port);
      if (!success) {
        failedTestCases.push(testCase.description);
      }
    }
    return {
      count,
      failedTestCases,
    };
  }

  private async runTestCase(
    testSuite: TestSuite,
    testCase: TestCase,
    port: number
  ): Promise<boolean> {
    const rootDirPath = await prepareTestDir();
    const appDir = await prepareAppDir();
    const api = await init(core, this.setupEnvironment);
    const workspace = await api.getWorkspace({
      versionCode: "test-test",
      filePath: rootDirPath,
      logLevel: "warn",
    });
    if (!workspace) {
      throw new Error(`Unable to create workspace: ${rootDirPath}`);
    }
    const context = await this.browser.newContext();
    const page = await context.newPage();
    let browserLogs: string[] = [];
    page.on("console", (message) =>
      browserLogs.push(
        `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
      )
    );
    page.on("pageerror", (exception) => browserLogs.push(inspect(exception)));
    await page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MILLIS);
    const controller = new AppController(page, workspace, port);
    await controller.start();
    try {
      console.log(chalk.gray(`▶️  ${testCase.description}`));
      const testCasePromise = testCase.run({
        appDir,
        controller,
        outputDirPath: this.outputDirPath,
      });
      await Promise.race([
        testCasePromise,
        new Promise((_, reject) =>
          setTimeout(
            () =>
              reject(
                `Test case timeout of ${
                  TEST_CASE_TIMEOUT_MILLIS / 1000
                }s exceeded`
              ),
            TEST_CASE_TIMEOUT_MILLIS
          )
        ),
      ]);
      console.log(chalk.green(`✅ ${testCase.description}`));
      return true;
    } catch (e) {
      console.log(chalk.red(`❌ ${testCase.description}`));
      console.error(e);
      console.error(`Browser logs:\n${browserLogs.join("\n")}`);
      await page.screenshot({
        path: path.join(
          __dirname,
          "..",
          "__failures__",
          `${testSuite.description} - ${testCase.description}.png`
        ),
      });
      return false;
    } finally {
      await page.close();
      await context.close();
      await controller.stop();
      await workspace.dispose();
      // Note: there seems to be a race condition where esbuild is spawned after
      // the directory has been deleted, resulting in a crash.
      // For now, we don't delete temporary directories.
      //
      // await new Promise<void>((resolve, reject) =>
      //   rimraf(rootDirPath, (error) => (error ? reject(error) : resolve()))
      // );
    }

    function prepareAppDir(): AppDir {
      let lastDiskWriteMillis = 0;
      const appDir: AppDir = {
        rootPath: rootDirPath,
        update: async (f, content, { inMemoryOnly } = {}) => {
          if (!inMemoryOnly) {
            // In order to make sure that chokidar doesn't
            // mistakenly merge events, resulting in flaky tests
            // when they run very fast, force some time to elapse.
            const now = Date.now();
            if (lastDiskWriteMillis > now - 500) {
              await new Promise((resolve) =>
                setTimeout(resolve, lastDiskWriteMillis + 500 - now)
              );
            }
            lastDiskWriteMillis = Date.now();
          }
          const filePath = path.join(rootDirPath, f);
          let text: string;
          switch (content.kind) {
            case "edit": {
              const existing = await fs.readFile(filePath, "utf8");
              text = existing.replace(content.search, content.replace);
              break;
            }
            case "replace":
              text = content.text;
              break;
            default:
              throw assertNever(content);
          }
          if (inMemoryOnly === true) {
            await api.updateFileInMemory(filePath, text);
          } else {
            const dirPath = path.dirname(filePath);
            await fs.mkdirp(dirPath);
            await fs.writeFile(filePath, text, "utf8");
          }
        },
        remove: (f) => fs.unlink(path.join(rootDirPath, f)),
      };
      return appDir;
    }

    async function prepareTestDir() {
      // Ensure we don't have a cache directory.
      const cacheDirPath = path.join(
        testCase.testDir,
        "node_modules",
        ".previewjs"
      );
      if (await fs.pathExists(cacheDirPath)) {
        await fs.remove(cacheDirPath);
      }
      const tempParentDirPath = path.join(testCase.testDir, "..", "_tmp_");
      await fs.mkdirp(tempParentDirPath);
      const rootDirPath = await fs.mkdtemp(
        path.join(tempParentDirPath, "app-")
      );
      await fs.mkdirp(rootDirPath);
      await sync(testCase.testDir, rootDirPath);
      return rootDirPath;
    }
  }
}
export interface AppDir {
  rootPath: string;
  update(
    relativeFilePath: string,
    content:
      | {
          kind: "edit";
          search: string | RegExp;
          replace: string;
        }
      | {
          kind: "replace";
          text: string;
        },
    options?: {
      inMemoryOnly?: boolean;
    }
  ): Promise<void>;
  remove(relativeFilePath: string): Promise<void>;
}

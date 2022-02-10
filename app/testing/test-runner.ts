import * as core from "@previewjs/core";
import { init, SetupPreviewEnvironment } from "@previewjs/loader";
import assertNever from "assert-never";
import chalk from "chalk";
import fs from "fs-extra";
import path from "path";
import playwright from "playwright";
import rimraf from "rimraf";
import { AppController } from "./helpers/app-controller";
import { sync } from "./helpers/sync";
import { TestCase, TestSuite } from "./test-case";

const DEFAULT_PAGE_TIMEOUT_MILLIS = 60 * 1000;
const TEST_CASE_TIMEOUT_MILLIS = 120 * 1000;

export async function runTests({
  setupEnvironment,
  testSuites,
  processArgs,
  outputDirPath,
}: {
  setupEnvironment: SetupPreviewEnvironment;
  testSuites: Array<Promise<TestSuite>>;
  processArgs: string[];
  outputDirPath: string;
}): Promise<void> {
  const filters = processArgs.slice(2);
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
        filterTestSuite &&
        testSuiteDescription.includes(filterTestSuite) &&
        (!filterTestCase || testCaseDescription.includes(filterTestCase))
      ) {
        return true;
      }
    }
    return false;
  };
  const testRunner = new TestRunner(setupEnvironment, outputDirPath);
  await testRunner.start();
  let testSuitesCount = 0;
  let testCasesCount = 0;
  let failedTestSuites = 0;
  let totalDurationMillis = 0;
  const failedTests: string[] = [];
  for (const testSuite of await Promise.all(testSuites)) {
    testSuite.testCases = testSuite.testCases.filter((testCase) =>
      matchesAtLeastOneFilter(testSuite.description, testCase.description)
    );
    if (testSuite.testCases.length === 0) {
      continue;
    }
    testSuitesCount += 1;
    const { count, failedTestCases, durationMillis } =
      await testRunner.runTestSuite(testSuite);
    totalDurationMillis += durationMillis;
    testCasesCount += count;
    if (failedTestCases.length > 0) {
      failedTestSuites += 1;
      failedTests.push(
        ...failedTestCases.map((name) => `${testSuite.description} - ${name}`)
      );
    }
  }
  await testRunner.stop();
  console.log(
    `Test summary:\n${testSuitesCount} test suites run, ${failedTestSuites} failed.\n${testCasesCount} test cases run, ${
      failedTests.length
    } failed.\nTotal time: ${totalDurationMillis / 1000}s.`
  );
  if (failedTests.length > 0) {
    console.error(`The following tests failed:`);
    for (const name of failedTests) {
      console.error(`• ${name}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

class TestRunner {
  private browser!: playwright.Browser;

  constructor(
    private readonly setupEnvironment: SetupPreviewEnvironment,
    private readonly outputDirPath: string
  ) {}

  async start() {
    const headless = process.env["HEADLESS"] !== "0";
    this.browser = await playwright.chromium.launch({
      headless,
      devtools: !headless,
    });
  }

  async stop() {
    await this.browser.close();
  }

  async runTestSuite(testSuite: TestSuite) {
    console.log(chalk.magenta(`📚 Test suite: ${testSuite.description}`));
    let count = 0;
    const startTimestamp = Date.now();
    const failedTestCases: string[] = [];
    for (const testCase of testSuite.testCases) {
      count += 1;
      const success = await this.runTestCase(testCase);
      if (!success) {
        failedTestCases.push(testCase.description);
      }
    }
    return {
      count,
      failedTestCases,
      durationMillis: Date.now() - startTimestamp,
    };
  }

  private async runTestCase(testCase: TestCase): Promise<boolean> {
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
    if (process.env["DEBUG"] == "1") {
      page.on("console", (message) =>
        console.log(
          `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
        )
      );
      page.on("pageerror", ({ message }) => console.log(message));
    }
    await page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MILLIS);
    const controller = new AppController(page, workspace);
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
      return false;
    } finally {
      await page.close();
      await context.close();
      await controller.stop();
      await workspace.dispose();
    }

    function prepareAppDir(): AppDir {
      const appDir: AppDir = {
        rootPath: rootDirPath,
        update: async (f, content, { inMemoryOnly } = {}) => {
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
      const rootDirPath = path.join(testCase.testDir, "..", "tmp");
      rimraf.sync(rootDirPath);
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

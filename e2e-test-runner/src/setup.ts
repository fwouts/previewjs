import {
  createWorkspace,
  FrameworkPluginFactory,
  loadPreviewEnv,
  SetupPreviewEnvironment,
} from "@previewjs/core";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import assertNever from "assert-never";
import fs from "fs-extra";
import path from "path";
import playwright from "playwright";
import { inspect } from "util";
import { afterAll, afterEach, beforeAll, beforeEach } from "vitest";
import type { AppDir } from "./app-dir";
import { AppController } from "./helpers/app-controller";
import { sync } from "./helpers/sync";

const DEFAULT_PAGE_TIMEOUT_MILLIS = 60 * 1000;
const PORT = 8090 + parseInt(process.env.VITEST_POOL_ID || "0");

let browser: playwright.Browser | null = null;
let setupEnvironment: SetupPreviewEnvironment | null = null;

export function defineSetupEnvironment(fn: SetupPreviewEnvironment) {
  setupEnvironment = fn;
}

beforeAll(async () => {
  const headless = process.env.HEADLESS !== "0";
  browser = await playwright.chromium.launch({
    headless,
    devtools: !headless,
  });
});

afterAll(async () => {
  await browser?.close();
});

beforeEach(async (ctx) => {
  ctx.setupTest = async (testAppName, frameworkPluginFactories) => {
    if (!setupEnvironment) {
      throw new Error(`Please ensure that defineSetupEnvironment() is called.`);
    }
    if (!browser) {
      throw new Error(`Expected a browser to be running.`);
    }

    const testFilepath = ctx.meta.file?.filepath;
    if (!testFilepath) {
      throw new Error(`Expected a test filepath.`);
    }

    const testDir = path.join(
      path.dirname(testFilepath),
      "..",
      "..",
      "..",
      "test-apps",
      testAppName
    );
    const outputDirPath = path.join(testDir, "output");
    const rootDirPath = await prepareTestDir();
    const appDir = await prepareAppDir();
    const env = await loadPreviewEnv({
      rootDirPath,
      setupEnvironment,
      frameworkPluginFactories,
    });
    if (!env) {
      throw new Error(`Unable to load preview environment`);
    }
    const memoryReader = createMemoryReader();
    const reader = createStackedReader([
      memoryReader,
      createFileSystemReader({
        watch: true,
      }),
    ]);
    const workspace = await createWorkspace({
      versionCode: "test-test",
      logLevel: "warn",
      rootDirPath,
      frameworkPlugin: env.frameworkPlugin,
      reader,
      middlewares: [],
      ...env.previewEnv,
    });
    if (!workspace) {
      throw new Error(`Unable to create workspace`);
    }
    const context = await browser.newContext();
    const page = await context.newPage();
    let browserLogs: string[] = [];
    page.on("console", (message) =>
      browserLogs.push(
        `${message.type().substr(0, 3).toUpperCase()} ${message.text()}`
      )
    );
    page.on("pageerror", (exception) => browserLogs.push(inspect(exception)));
    await page.setDefaultTimeout(DEFAULT_PAGE_TIMEOUT_MILLIS);
    const controller = new AppController(page, workspace, PORT);
    await controller.start();
    afterEach(async () => {
      await page.close();
      await context.close();
      await controller.stop();
      await workspace.dispose();
    });
    return {
      appDir,
      controller,
      outputDirPath,
    };

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
          const absoluteFilePath = path.join(rootDirPath, f);
          let text: string;
          switch (content.kind) {
            case "edit": {
              const existing = await fs.readFile(absoluteFilePath, "utf8");
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
            await memoryReader.updateFile(absoluteFilePath, text);
          } else {
            const dirPath = path.dirname(absoluteFilePath);
            await fs.mkdirp(dirPath);
            await fs.writeFile(absoluteFilePath, text, "utf8");
          }
        },
        rename: (from, to) =>
          fs.rename(path.join(rootDirPath, from), path.join(rootDirPath, to)),
        remove: (f) => fs.unlink(path.join(rootDirPath, f)),
      };
      return appDir;
    }

    async function prepareTestDir() {
      // Ensure we don't have a cache directory.
      const cacheDirPath = path.join(testDir, "node_modules", ".previewjs");
      if (await fs.pathExists(cacheDirPath)) {
        await fs.remove(cacheDirPath);
      }
      const tempParentDirPath = path.join(testDir, "..", "_tmp_");
      await fs.mkdirp(tempParentDirPath);
      const rootDirPath = await fs.mkdtemp(
        path.join(tempParentDirPath, "app-")
      );
      await fs.mkdirp(rootDirPath);
      await sync(testDir, rootDirPath);
      return rootDirPath;
    }
  };
});

declare module "vitest" {
  export interface TestContext {
    setupTest: (
      testDir: string,
      frameworkPluginFactories: FrameworkPluginFactory[]
    ) => Promise<{
      appDir: AppDir;
      controller: AppController;
      outputDirPath: string;
    }>;
  }
}

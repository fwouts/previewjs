/// <reference types="@previewjs/iframe/preview/window" />

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { createChromelessWorkspace } from "@previewjs/chromeless";
import type { FrameworkPluginFactory } from "@previewjs/core";
import getPort from "get-port";
import type { LoggedMessagesMatcher } from "./events";
import { expectLoggedMessages } from "./events";
import type { FileManager } from "./file-manager";
import { prepareFileManager } from "./file-manager";

// Port allocated for the duration of the process.
let port: number;

type TestPreview = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof createChromelessWorkspace>>["startPreview"]
  >
> & {
  page: Page;
  fileManager: FileManager;
  expectLoggedMessages: LoggedMessagesMatcher;
};

export const previewTest = (
  frameworkPlugins: FrameworkPluginFactory[],
  testProjectDirPath: string
) => {
  const testFn = (
    title: string,
    testFunction: (preview: TestPreview) => Promise<void>,
    playwrightTest: typeof test.only = test
  ) => {
    return playwrightTest(title, async ({ page }) => {
      test.setTimeout(120000);
      if (!port) {
        port = await getPort();
      }
      let showingComponent = false;
      const { rootDir, reader, fileManager } = await prepareFileManager({
        testProjectDirPath,
        onBeforeFileUpdated: async () => {
          if (!showingComponent) {
            return;
          }
          await page.$eval("body", async () => {
            return window.__expectFutureRefresh__();
          });
        },
        onAfterFileUpdated: async () => {
          if (!showingComponent) {
            return;
          }
          await page.$eval("body", async () => {
            const INIT_WAIT_SECONDS = 5;

            // It's possible that __waitForExpectedRefresh__ isn't ready yet.
            let waitStart = Date.now();
            while (
              !window.__waitForExpectedRefresh__ &&
              Date.now() - waitStart < INIT_WAIT_SECONDS * 1000
            ) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
            if (!window.__waitForExpectedRefresh__) {
              throw new Error(
                `window.__waitForExpectedRefresh__ is still not initialised after waiting for ${INIT_WAIT_SECONDS} seconds.`
              );
            }
            return window.__waitForExpectedRefresh__();
          });
          await preview.iframe.waitForIdle();
        },
      });
      const workspace = await createChromelessWorkspace({
        frameworkPlugins,
        rootDir,
        reader,
      });
      const preview = await workspace.startPreview(page, {
        port,
      });
      const previewShow = preview.show.bind(preview);
      preview.show = (...args) => {
        showingComponent = true;
        return previewShow(...args);
      };
      try {
        await testFunction({
          page,
          fileManager,
          get expectLoggedMessages() {
            return expectLoggedMessages(this.events.get());
          },
          ...preview,
        });
      } finally {
        await preview.stop();
      }
    });
  };
  testFn.only = (
    title: string,
    testFunction: (preview: TestPreview) => Promise<void>
  ) => {
    return testFn(title, testFunction, test.only);
  };
  testFn.skip = (
    title: string,
    testFunction: (preview: TestPreview) => Promise<void>
  ) => {
    return testFn(title, testFunction, test.skip);
  };
  return testFn;
};

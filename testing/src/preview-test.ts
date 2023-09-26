/// <reference types="@previewjs/iframe/preview/window" />

import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import {
  createChromelessWorkspace,
  getPreviewIframe,
} from "@previewjs/chromeless";
import type { FrameworkPluginFactory } from "@previewjs/core";
import getPort from "get-port";
import type playwright from "playwright";
import type { ErrorsMatcher, LoggedMessagesMatcher } from "./events";
import { expectErrors, expectLoggedMessages } from "./events";
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
  expectErrors: ErrorsMatcher;
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
          await runInIframe(page, async () => {
            return window.__expectFutureRefresh__();
          });
        },
        onAfterFileUpdated: async () => {
          if (!showingComponent) {
            return;
          }
          await runInIframe(page, async () => {
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
          get expectErrors() {
            return expectErrors(this.events.get());
          },
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

async function runInIframe(
  page: playwright.Page,
  fn: () => void | Promise<void>
) {
  const frame = await getPreviewIframe(page);
  try {
    await frame.$eval("body", fn);
  } catch (e: any) {
    if (
      e.message.includes(
        "Execution context was destroyed, most likely because of a navigation"
      ) ||
      e.message.includes(
        "Unable to adopt element handle from a different document"
      ) ||
      e.message.includes("Cannot find context with specified id")
    ) {
      await runInIframe(page, fn);
    } else {
      throw e;
    }
  }
}

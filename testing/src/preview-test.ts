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
import type { LoggedMessagesMatcher } from "./events";
import { expectLoggedMessages } from "./events";
import type { FileManager } from "./file-manager";
import { prepareFileManager } from "./file-manager";

// Port allocated for the duration of the process.
let port: number;

type TestPreview = Awaited<
  ReturnType<
    Awaited<ReturnType<typeof createChromelessWorkspace>>["preview"]["start"]
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
      const { rootDirPath, reader, fileManager } = await prepareFileManager({
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
            // It's possible that __waitForExpectedRefresh__ isn't ready yet.
            let waitStart = Date.now();
            while (
              !window.__waitForExpectedRefresh__ &&
              Date.now() - waitStart < 5000
            ) {
              await new Promise((resolve) => setTimeout(resolve, 100));
            }
            return window.__waitForExpectedRefresh__();
          });
          await preview.iframe.waitForIdle();
        },
      });
      const workspace = await createChromelessWorkspace({
        frameworkPlugins,
        rootDirPath,
        reader,
      });
      const preview = await workspace.preview.start(page, {
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

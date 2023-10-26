import type { Page } from "@playwright/test";
import { test } from "@playwright/test";
import { createChromelessWorkspace } from "@previewjs/chromeless";
import type { FrameworkPluginFactory } from "@previewjs/core";
import type { PreviewEvent } from "@previewjs/iframe";
import getPort from "get-port";
import type { ErrorsMatcher, LoggedMessagesMatcher } from "./events.js";
import { expectErrors, expectLoggedMessages } from "./events.js";
import type { FileManager } from "./file-manager.js";
import { prepareFileManager } from "./file-manager.js";

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
  frameworkPlugin: FrameworkPluginFactory,
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
      let resolvePromises: Array<() => void> = [];
      let pendingChanges: Promise<void> | null = null;
      const { rootDir, reader, fileManager } = await prepareFileManager({
        testProjectDirPath,
        onBeforeFileUpdated: async () => {
          if (!showingComponent) {
            return;
          }
          await pendingChanges;
          pendingChanges = new Promise<void>((resolve) => {
            resolvePromises.push(resolve);
          });
        },
        onAfterFileUpdated: async () => {
          if (!showingComponent) {
            return;
          }
          await pendingChanges;
          pendingChanges = null;
        },
      });
      const workspace = await createChromelessWorkspace({
        frameworkPlugin,
        rootDir,
        reader,
      });
      const preview = await workspace.startPreview(page, {
        port,
      });
      await page.exposeFunction(
        "__ON_PREVIEWJS_EVENT__",
        (event: PreviewEvent) => {
          if (
            event.kind === "vite-before-update" ||
            event.kind === "rendered" ||
            event.kind === "error"
          ) {
            for (const resolve of resolvePromises) {
              resolve();
            }
            resolvePromises = [];
          }
        }
      );
      await page.evaluate(() => {
        const proxied = window.__PREVIEWJS_CONTROLLER__;
        window.__PREVIEWJS_CONTROLLER__ = {
          onPreviewEvent(event) {
            // @ts-expect-error
            window.__ON_PREVIEWJS_EVENT__(event);
            proxied.onPreviewEvent(event);
          },
        };
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
            return expectErrors(() => this.events.get());
          },
          get expectLoggedMessages() {
            return expectLoggedMessages(() => this.events.get());
          },
          ...preview,
        });
      } finally {
        await preview.stop();
      }
      await workspace.dispose();
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

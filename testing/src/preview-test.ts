import { test } from "@playwright/test";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { startPreview } from "./preview";

export const previewTest = (
  frameworkPluginFactories: FrameworkPluginFactory[],
  workspaceDirPath: string
) => {
  const testFn = (
    title: string,
    testFunction: (
      preview: Awaited<ReturnType<typeof startPreview>>
    ) => Promise<void>,
    playwrightTest: typeof test.only = test
  ) => {
    return playwrightTest(title, async ({ page }) => {
      const preview = await startPreview(
        frameworkPluginFactories,
        page,
        workspaceDirPath
      );
      try {
        await testFunction(preview);
      } finally {
        await preview.stop();
      }
    });
  };
  testFn.describe = (title: string, callback: () => void) =>
    test.describe(title, callback);
  testFn.only = (
    title: string,
    testFunction: (
      preview: Awaited<ReturnType<typeof startPreview>>
    ) => Promise<void>
  ) => {
    return testFn(title, testFunction, test.only);
  };
  return testFn;
};

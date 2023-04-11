import { decodeComponentId } from "@previewjs/api";
import { createChromelessWorkspace } from "@previewjs/chromeless";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { globby } from "globby";
import type playwright from "playwright";

export async function generateScreenshots({
  page,
  frameworkPlugins,
  filePathPattern,
  cwd = process.cwd(),
  generateScreenshotPath,
  onError,
  onScreenshotGenerated,
}: {
  /**
   * A Playwright page which will be used to load the preview.
   *
   * This can be used to emulate different viewports, for example a Pixel 2 mobile phone:
   * ```js
   * const browser = await playwright.chromium.launch();
   * const context = await browser.newContext(playwright.devices["Pixel 2"]);
   * const page = await context.newPage();
   * ```
   */
  page: playwright.Page;

  /**
   * A list of Preview.js framework plugins (typically just one).
   *
   * Example:
   * ```js
   * [(await import("@previewjs/plugin-react")).default]
   * ```
   */
  frameworkPlugins: FrameworkPluginFactory[];

  /**
   * A file path pattern used to select files from which to render components and stories.
   *
   * Follows [minimatch](https://github.com/isaacs/minimatch) syntax.
   *
   * Example: `"**\*.stories.{js,ts,js,tsx}"`
   */
  filePathPattern: string;

  /**
   * Workspace root directory (should contain package.json).
   */
  cwd?: string;

  /**
   * Callback invoked to generate the path at which the screenshot will be generated.
   *
   * Example:
   * ```js
   * generateScreenshotPath({ filePath, name }) {
   *   return `${filePath}-${name}.png`;
   * }
   * ```
   */
  generateScreenshotPath: (options: {
    filePath: string;
    name: string;
  }) => string;

  /**
   * Callback invoked when a component or story failed to render.
   *
   * Return `true` to halt or `false` to ignore the failure and keep generating other screenshots.
   */
  onError?: (
    error: Error,
    options: {
      filePath: string;
      name: string;
    }
  ) => boolean;

  /**
   * Callback invoked after a screenshot has been successfully generated.
   */
  onScreenshotGenerated?: (options: {
    filePath: string;
    name: string;
    screenshotPath: string;
  }) => void;
}) {
  const workspace = await createChromelessWorkspace({
    frameworkPlugins,
    rootDirPath: cwd,
  });
  const preview = await workspace.preview.start(page);
  const filePaths = await globby(filePathPattern, {
    gitignore: true,
    ignore: ["**/node_modules/**"],
    cwd,
    followSymbolicLinks: false,
  });
  const { components } = await workspace.detectComponents({
    filePaths,
  });
  for (const component of components) {
    const { filePath, name } = decodeComponentId(component.componentId);
    try {
      await preview.show(component.componentId);
      const screenshotPath = generateScreenshotPath({ filePath, name });
      await preview.iframe.takeScreenshot(screenshotPath);
      if (onScreenshotGenerated) {
        onScreenshotGenerated({ filePath, name, screenshotPath });
      }
    } catch (e: any) {
      if (onError) {
        const halt = onError(e, { filePath, name });
        if (halt) {
          return;
        }
      } else {
        throw new Error(
          `Unable to generate screenshot for ${component.componentId}`,
          // https://stackoverflow.com/a/42755876
          // @ts-ignore
          { cause: e }
        );
      }
    }
  }
  await preview.stop();
  await workspace.dispose();
}

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
  suppressErrors = false,
  generateScreenshotPath,
  onScreenshot,
}: {
  page: playwright.Page;
  frameworkPlugins: FrameworkPluginFactory[];
  filePathPattern: string;
  cwd?: string;
  suppressErrors?: boolean;
  generateScreenshotPath: (options: {
    filePath: string;
    name: string;
  }) => string;
  onScreenshot?: (options: {
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
      if (onScreenshot) {
        onScreenshot({ filePath, name, screenshotPath });
      }
    } catch (e: any) {
      const messsage = `Unable to generate screenshot for ${component.componentId}`;
      if (suppressErrors) {
        console.warn(`${messsage}:\n${e.message}\n`);
      } else {
        // https://stackoverflow.com/a/42755876
        // @ts-ignore
        throw new Error(messsage, { cause: e });
      }
    }
  }
  await preview.stop();
  await workspace.dispose();
}

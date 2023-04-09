import { decodeComponentId } from "@previewjs/api";
import { createChromelessWorkspace } from "@previewjs/chromeless";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { globby } from "globby";
import path from "path";
import type playwright from "playwright";

export async function generateScreenshots({
  page,
  frameworkPlugins,
  filePathPattern,
  cwd = process.cwd(),
  suppressErrors = false,
}: {
  page: playwright.Page;
  frameworkPlugins: FrameworkPluginFactory[];
  filePathPattern?: string;
  cwd?: string;
  suppressErrors?: boolean;
}) {
  const workspace = await createChromelessWorkspace({
    frameworkPlugins,
    rootDirPath: cwd,
  });
  const preview = await workspace.preview.start(page);
  const filePaths = filePathPattern
    ? await globby(filePathPattern, {
        gitignore: true,
        ignore: ["**/node_modules/**"],
        cwd,
        absolute: true,
        followSymbolicLinks: false,
      })
    : undefined;
  const { components } = await workspace.detectComponents({
    filePaths,
  });
  const generatedScreenshots: string[] = [];
  for (const component of components) {
    const { filePath, name } = decodeComponentId(component.componentId);
    try {
      await preview.show(component.componentId);
      const screenshotPath = path.join(
        cwd,
        path.dirname(filePath),
        "__screenshots__",
        name + ".png"
      );
      await preview.iframe.takeScreenshot(screenshotPath);
      generatedScreenshots.push(screenshotPath);
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
  return {
    generatedScreenshots,
  };
}

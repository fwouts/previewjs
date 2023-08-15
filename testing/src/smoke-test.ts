import type { FrameworkPluginFactory } from "@previewjs/core";
import path from "path";
import { previewTest } from "./preview-test";

export function smokeTests({
  projectsDir,
  pluginFactory,
  previewableIdsPerProject,
}: {
  projectsDir: string;
  pluginFactory: FrameworkPluginFactory;
  previewableIdsPerProject: Record<string, string[]>;
}) {
  for (const [projectName, previewableIds] of Object.entries(
    previewableIdsPerProject
  )) {
    const appDir = path.join(projectsDir, projectName);
    for (const previewableId of previewableIds) {
      const [filePath, componentName] = previewableId.split(":") as [
        string,
        string,
      ];
      previewTest([pluginFactory], appDir)(
        `${projectName}/${previewableId}`,
        async (preview) => {
          await preview.show(previewableId);
          await preview.iframe.waitForSelector("#ready");
          const fileExt = path.extname(filePath);
          const filePrefix = filePath.substring(
            0,
            filePath.length - fileExt.length
          );
          await preview.iframe.takeScreenshot(
            path.join(
              appDir,
              `${filePrefix}${
                filePrefix.endsWith(componentName) ? "" : `_${componentName}`
              }_screenshot_${process.platform}.png`
            )
          );
        }
      );
    }
  }
}

import type { FrameworkPluginFactory } from "@previewjs/core";
import path from "path";
import { previewTest } from "./preview-test";

export function smokeTests({
  projectsDir,
  pluginFactory,
  componentIdsPerProject,
}: {
  projectsDir: string;
  pluginFactory: FrameworkPluginFactory;
  componentIdsPerProject: Record<string, string[]>;
}) {
  for (const [projectName, componentIds] of Object.entries(
    componentIdsPerProject
  )) {
    const appDir = path.join(projectsDir, projectName);
    for (const componentId of componentIds) {
      const [filePath, componentName] = componentId.split(":") as [
        string,
        string
      ];
      previewTest([pluginFactory], appDir)(
        `${projectName}/${componentId}`,
        async (preview) => {
          await preview.show(componentId);
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

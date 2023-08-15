import type { FrameworkPluginFactory } from "@previewjs/core";
import path from "path";
import { previewTest } from "./preview-test";

export function smokeTests({
  projectsDir,
  pluginFactory,
  idsPerProject,
}: {
  projectsDir: string;
  pluginFactory: FrameworkPluginFactory;
  idsPerProject: Record<string, string[]>;
}) {
  for (const [projectName, ids] of Object.entries(idsPerProject)) {
    const appDir = path.join(projectsDir, projectName);
    for (const id of ids) {
      const [filePath, componentName] = id.split(":") as [string, string];
      previewTest([pluginFactory], appDir)(
        `${projectName}/${id}`,
        async (preview) => {
          await preview.show(id);
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

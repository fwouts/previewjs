import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const smokeTestApp = (name: string) => path.join(__dirname, "apps", name);

test.describe.parallel("smoke tests", () => {
  for (const [appName, componentId] of [
    ["nuxt3-app", "app.vue:app"],
    ["vue3-app", "src/App.vue:App"],
  ] as const) {
    const appDir = smokeTestApp(appName);
    previewTest([pluginFactory], appDir)(appName, async (preview) => {
      await preview.show(componentId);
      await preview.iframe.waitForSelector("#ready");
      const [filePath, componentName] = componentId.split(":") as [
        string,
        string
      ];
      const fileExt = path.extname(filePath);
      await preview.iframe.takeScreenshot(
        path.join(
          appDir,
          `${filePath.substring(
            0,
            filePath.length - fileExt.length
          )}_${componentName}_screenshot_${process.platform}.png`
        )
      );
    });
  }
});

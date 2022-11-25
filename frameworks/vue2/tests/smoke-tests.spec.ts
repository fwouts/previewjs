import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const smokeTestApp = (name: string) => path.join(__dirname, "apps", name);

test.describe("smoke tests", () => {
  for (const [appName, componentId] of [
    ["nuxt2-app", "pages/index.vue:index"],
    ["vue2", "src/App.vue:App"],
    ["vue2-app", "src/App.vue:App"],
  ] as const) {
    const appDir = smokeTestApp(appName);
    previewTest([pluginFactory], appDir)(appName, async (preview) => {
      await preview.show(componentId);
      await preview.iframe.takeScreenshot(
        path.join(appDir, `__screenshot__${process.platform}.png`)
      );
    });
  }
});

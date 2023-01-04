import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const smokeTestApp = (name: string) => path.join(__dirname, "apps", name);

test.describe("smoke tests", () => {
  for (const [appName, componentId] of [
    ["preact-ts", "src/components/app.tsx:App"],
    ["storybook-js", "src/App.jsx:App"],
    ["storybook-ts", "src/stories/Button.stories.tsx:Primary"],
    ["vite-preact", "src/app.tsx:App"],
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

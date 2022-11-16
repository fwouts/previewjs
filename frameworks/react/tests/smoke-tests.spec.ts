import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const smokeTestApp = (name: string) =>
  path.join(__dirname, "../../../smoke-test-apps/" + name);

test.describe("smoke tests", () => {
  for (const [appName, componentId] of [
    ["cra-js", "src/App.js:App"],
  ] as const) {
    previewTest([pluginFactory], smokeTestApp(appName))(
      appName,
      async (preview) => {
        await preview.show(componentId);
        await preview.iframe.takeScreenshot(
          path.resolve(
            __dirname,
            "__screenshots__",
            process.platform,
            `${appName}.png`
          )
        );
      }
    );
  }
});

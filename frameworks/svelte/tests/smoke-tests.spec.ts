import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const smokeTestApp = (name: string) => path.join(__dirname, "apps", name);

test.describe("smoke tests", () => {
  for (const [appName, componentId] of [
    ["svelte", "src/App.svelte:App"],
    ["svelte-app", "src/App.svelte:App"],
    ["sveltekit-app", "src/routes/+page.svelte:+page"],
    ["sveltekit-demo", "src/routes/Header.svelte:Header"],
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

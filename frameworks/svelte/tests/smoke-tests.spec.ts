import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const smokeTestApp = (name: string) => path.join(__dirname, "apps", name);

test.describe.parallel("smoke tests", () => {
  for (const [appName, componentId] of [
    ["svelte-app", "src/App.svelte:App"],
    ...(parseInt(process.versions.node.split(".")[0]!) >= 16
      ? [
          // SvelteKit requires Node 16.
          // See https://github.com/sveltejs/kit/issues/2412
          ["sveltekit-app", "src/routes/+page.svelte:+page"],
          ["sveltekit-demo", "src/routes/Header.svelte:Header"],
        ]
      : []),
  ] as const) {
    const appDir = smokeTestApp(appName);
    previewTest([pluginFactory], appDir)(appName, async (preview) => {
      await preview.show(componentId);
      await preview.iframe.waitForSelector("#ready");
      await preview.iframe.takeScreenshot(
        path.join(appDir, `__screenshot__${process.platform}.png`)
      );
    });
  }
});

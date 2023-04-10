import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "svelte");

test.describe.parallel("svelte/error handling", () => {
  const test = previewTest([pluginFactory], testApp);

  test("handles syntax errors gracefully", async (preview) => {
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.iframe.waitForSelector("img");
    await preview.fileManager.update("src/App.svelte", {
      replace: /<img .*\/>/g,
      with: "<img",
    });
    await preview.expectLoggedMessages.toMatch([`Expected >`]);
    // The component should still be shown.
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when encountering broken module imports before update", async (preview) => {
    await preview.fileManager.update("src/App.svelte", {
      replace: "lib/Counter.svelte",
      with: "lib/Broken.svelte",
    });
    await preview.show("src/App.svelte:App").catch(() => {
      /* expected error */
    });
    await preview.expectLoggedMessages.toMatch([
      "Failed to load url /src/lib/Broken.svelte",
      "Failed to fetch dynamically imported module",
      "Failed to fetch dynamically imported module",
    ]);
    await preview.fileManager.update("src/App.svelte", {
      replace: "lib/Broken.svelte",
      with: "lib/Counter.svelte",
    });
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when encountering broken module imports after update", async (preview) => {
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.fileManager.update("src/App.svelte", {
      replace: "lib/Counter.svelte",
      with: "lib/Broken.svelte",
    });
    await preview.expectLoggedMessages.toMatch([
      "Failed to load url /src/lib/Broken.svelte",
      "Failed to reload /src/App.svelte. This could be due to syntax errors or importing non-existent modules.",
    ]);
    await preview.fileManager.update("src/App.svelte", {
      replace: "lib/Broken.svelte",
      with: "lib/Counter.svelte",
    });
    await preview.iframe.waitForSelector(".logo");
  });

  // TODO: Check if it's possible to make this test pass.
  // Currently, it doesn't reload when App.svelte is fixed.
  test.skip("fails correctly when encountering broken CSS before update", async (preview) => {
    await preview.fileManager.update("src/App.svelte", {
      replace: ".logo {",
      with: " BROKEN",
    });
    await preview.show("src/App.svelte:App").catch(() => {
      /* expected error */
    });
    await preview.expectLoggedMessages.toMatch([
      ["Identifier is expected", "App.svelte:3:5: Unknown word"],
      "Failed to fetch dynamically imported module",
      "Failed to fetch dynamically imported module",
    ]);
    await preview.fileManager.update("src/App.svelte", {
      replace: " BROKEN",
      with: ".logo {",
    });
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when encountering broken CSS after update", async (preview) => {
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.fileManager.update("src/App.svelte", {
      replace: ".logo {",
      with: " BROKEN",
    });
    await preview.expectLoggedMessages.toMatch([
      ["Identifier is expected", "App.svelte:3:5: Unknown word"],
    ]);
    await preview.fileManager.update("src/App.svelte", {
      replace: " BROKEN",
      with: ".logo {",
    });
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when file is missing after update", async (preview) => {
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.fileManager.rename(
      "src/App.svelte",
      "src/App-renamed.svelte"
    );
    await preview.expectLoggedMessages.toMatch([
      "Failed to reload /src/App.svelte",
      "Failed to reload /src/App.svelte",
    ]);
  });
});

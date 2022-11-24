import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = path.join(__dirname, "apps", "vue3");

test.describe("vue3/error handling", () => {
  const test = previewTest([pluginFactory], testApp);

  test("handles syntax errors gracefully", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.iframe.waitForSelector("img");
    await preview.fileManager.update("src/App.vue", {
      replace: /<img .*\/>/g,
      with: "<img",
    });
    await preview.expectLoggedMessages.toMatch([
      "Attribute name cannot contain U+0022",
      "Failed to reload /src/App.vue.",
    ]);
    // The component should still be shown.
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when encountering broken module imports before update", async (preview) => {
    await preview.fileManager.update("src/App.vue", {
      replace: "components/HelloWorld.vue",
      with: "components/Broken.vue",
    });
    await preview.show("src/App.vue:App");
    await preview.expectLoggedMessages.toMatch([
      "Failed to fetch dynamically imported module",
      "Failed to fetch dynamically imported module",
    ]);
    await preview.fileManager.update("src/App.vue", {
      replace: "components/Broken.vue",
      with: "components/HelloWorld.vue",
    });
    await preview.iframe.waitForSelector(".hello");
  });

  test("fails correctly when encountering broken module imports after update", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".hello");
    await preview.fileManager.update("src/App.vue", {
      replace: "components/HelloWorld.vue",
      with: "components/Broken.vue",
    });
    await preview.expectLoggedMessages.toMatch([
      "Failed to reload /src/App.vue. This could be due to syntax errors or importing non-existent modules.",
    ]);
    await preview.fileManager.update("src/App.vue", {
      replace: "components/Broken.vue",
      with: "components/HelloWorld.vue",
    });
    await preview.iframe.waitForSelector(".hello");
  });

  // TODO: Check if it's possible to make this test pass.
  // Currently, it doesn't reload when App.vue is fixed.
  test.skip("fails correctly when encountering broken CSS before update", async (preview) => {
    await preview.fileManager.update("src/App.vue", {
      replace: "#app {",
      with: " BROKEN",
    });
    await preview.show("src/App.vue:App");
    await preview.expectLoggedMessages.toMatch([
      "Failed to fetch dynamically imported module",
      "Failed to fetch dynamically imported module",
    ]);
    await preview.fileManager.update("src/App.vue", {
      replace: " BROKEN",
      with: "#app {",
    });
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when encountering broken CSS after update", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.fileManager.update("src/App.vue", {
      replace: "#app {",
      with: " BROKEN",
    });
    await preview.expectLoggedMessages.toMatch([
      "Unknown word",
      "Failed to reload /src/App.vue?vue&type=style&index=0&lang.css",
    ]);
    await preview.fileManager.update("src/App.vue", {
      replace: " BROKEN",
      with: "#app {",
    });
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when file is missing after update", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.fileManager.rename("src/App.vue", "src/App-renamed.vue");
    await preview.expectLoggedMessages.toMatch([
      "ENOENT: no such file or directory, open '/src/App.vue'",
      "Failed to reload /src/App.vue",
      "Failed to reload /src/App.vue",
    ]);
  });
});

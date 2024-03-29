import { test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "vue3");

test.describe.parallel("vue3/error handling", () => {
  const test = previewTest(pluginFactory, testApp);

  test("handles syntax errors gracefully", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.iframe.waitForSelector("img");
    await preview.fileManager.update("src/App.vue", {
      replace: /<img .*\/>/g,
      with: "<img",
    });
    await preview.expectErrors.toMatch([
      "Attribute name cannot contain U+0022",
    ]);
    await preview.expectLoggedMessages.toMatch([]);
    // The component should still be shown.
    await preview.iframe.waitForSelector(".logo");
  });

  test("fails correctly when encountering broken module imports before update", async (preview) => {
    await preview.fileManager.update("src/App.vue", {
      replace: "components/HelloWorld.vue",
      with: "components/Broken.vue",
    });
    await preview.show("src/App.vue:App").catch(() => {
      /* expected error */
    });
    await preview.expectErrors.toMatch([
      "Failed to load url /src/components/Broken.vue",
    ]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.expectErrors.toMatch([
      "Failed to load url /src/components/Broken.vue",
    ]);
    await preview.expectLoggedMessages.toMatch([]);
    await preview.fileManager.update("src/App.vue", {
      replace: "components/Broken.vue",
      with: "components/HelloWorld.vue",
    });
    await preview.iframe.waitForSelector(".hello");
  });

  test("fails correctly when encountering broken CSS before update", async (preview) => {
    await preview.fileManager.update("src/App.vue", {
      replace: "#app {",
      with: " BROKEN",
    });
    await preview.show("src/App.vue:App").catch(() => {
      /* expected error */
    });
    await preview.expectErrors.toMatch(["App.vue:3:3: Unknown word"]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.expectErrors.toMatch(["App.vue:3:3: Unknown word"]);
    await preview.expectLoggedMessages.toMatch([]);
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
    // TODO: Find a way to prevent silent failures.
    await preview.expectErrors.toMatch([]);
    await preview.expectLoggedMessages.toMatch([]);
  });
});

import { test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "svelte");

test.describe.parallel("svelte/console", () => {
  const test = previewTest(pluginFactory, testApp);

  test("intercepts logs", async (preview) => {
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.fileManager.update(
      "src/App.svelte",
      `<div class="App-updated-1">
        {foo}
      </div>

      <script>
      export let foo = 123;
      console.log("Render 1");
      </script>`
    );
    await preview.iframe.waitForSelector(".App-updated-1");
    await preview.expectLoggedMessages.toMatch(["Render 1", "Render 1"], "log");
    await preview.fileManager.update(
      "src/App.svelte",
      `<div class="App-updated-2">
        {foo}
      </div>

      <script>
      export let foo = 123;
      console.log("Render 2");
      </script>`
    );
    await preview.iframe.waitForSelector(".App-updated-2");
    await preview.expectLoggedMessages.toMatch(["Render 2", "Render 2"], "log");
  });
});

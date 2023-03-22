import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "svelte");

test.describe.parallel("svelte/jsx", () => {
  const test = previewTest([pluginFactory], testApp);

  test("renders JSX props (plain HTML tag)", async (preview) => {
    await preview.show(
      "src/App.svelte:App",
      `properties = {
        children: <div>some JSX</div>
      }`
    );
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'some JSX')]"
    );
  });
});

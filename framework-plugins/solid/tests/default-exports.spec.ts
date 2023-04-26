import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "solid");

test.describe.parallel("solid/default exports", () => {
  const test = previewTest([pluginFactory], testApp);

  test("renders default export component (arrow function)", async (preview) => {
    await preview.fileManager.update(
      "src/App.tsx",
      `export default () => {
            return <div class="default-export">
              Hello, World!
            </div>
          }`
    );
    await preview.show("src/App.tsx:default");
    await preview.iframe.waitForSelector(".default-export");
  });

  test("renders default export component (named function)", async (preview) => {
    await preview.fileManager.update(
      "src/App.tsx",
      `export default function test() {
            return <div class="default-export">
              Hello, World!
            </div>
          }`
    );
    await preview.show("src/App.tsx:default");
    await preview.iframe.waitForSelector(".default-export");
  });

  test("renders default export component (anonymous function)", async (preview) => {
    await preview.fileManager.update(
      "src/App.tsx",
      `export default function() {
            return <div class="default-export">
              Hello, World!
            </div>
          }`
    );
    await preview.show("src/App.tsx:default");
    await preview.iframe.waitForSelector(".default-export");
  });
});

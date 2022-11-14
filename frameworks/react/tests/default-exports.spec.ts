import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = (suffix: string | number) =>
  path.join(__dirname, "../../../test-apps/react" + suffix);

for (const reactVersion of [16, 17, 18]) {
  test.describe(`v${reactVersion}`, () => {
    test.describe("react/default exports", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("renders default export component (arrow function)", async (preview) => {
        await preview.fileManager.update(
          "src/App.tsx",
          `export default () => {
            return <div className="default-export">
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
            return <div className="default-export">
              Hello, World!
            </div>
          }`
        );
        await preview.show("src/App.tsx:test");
        await preview.iframe.waitForSelector(".default-export");
      });

      test("renders default export component (anonymous function)", async (preview) => {
        await preview.fileManager.update(
          "src/App.tsx",
          `export default function() {
            return <div className="default-export">
              Hello, World!
            </div>
          }`
        );
        await preview.show("src/App.tsx:default");
        await preview.iframe.waitForSelector(".default-export");
      });
    });
  });
}

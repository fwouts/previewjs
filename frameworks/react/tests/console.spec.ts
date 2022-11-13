import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = (suffix: string | number) =>
  path.join(__dirname, "../../../test-apps/react" + suffix);

for (const reactVersion of [16, 17, 18]) {
  test.describe(`v${reactVersion}`, () => {
    test.describe("react/console", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("intercepts logs", async (preview) => {
        await preview.show("src/App.tsx:App");
        await preview.iframe.waitForSelector(".App");
        await preview.fileManager.update(
          "src/App.tsx",
          `function App() {
            console.log("Render 1");
            return (
              <div id="update-1">
                Hello, World!
              </div>
            );
          }`
        );
        await preview.iframe.waitForSelector("#update-1");
        preview.events.expectLoggedMessages(["Render 1"], "log");
        preview.events.clear();
        await preview.fileManager.update(
          "src/App.tsx",
          `function App() {
            console.log("Render 2");
            return (
              <div id="update-2">
                Hello, World!
              </div>
            );
          }`
        );
        await preview.iframe.waitForSelector("#update-2");
        preview.events.expectLoggedMessages(["Render 2"], "log");
      });
    });
  });
}

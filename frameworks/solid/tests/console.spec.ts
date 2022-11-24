import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = path.join(__dirname, "apps", "solid");

test.describe("solid/console", () => {
  const test = previewTest([pluginFactory], testApp);

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
    await preview.expectLoggedMessages.toMatch(["Render 1"], "log");
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
    await preview.expectLoggedMessages.toMatch(["Render 2"], "log");
  });
});

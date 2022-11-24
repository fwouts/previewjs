import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = path.join(__dirname, "apps", "solid");

test.describe("solid/error handling", () => {
  const test = previewTest([pluginFactory], testApp);

  test("handles syntax errors gracefully", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update("src/App.tsx", {
      replace: /<p>/g,
      with: "<p",
    });
    await preview.expectLoggedMessages.toMatch([
      `src${path.sep}App.tsx: Unexpected token`,
      "Failed to reload /src/App.tsx. This could be due to syntax errors or importing non-existent modules.",
    ]);
    // The component should still be shown.
    await preview.iframe.waitForSelector(".App");
  });

  test("fails correctly when encountering broken module imports before update", async (preview) => {
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "some-module";

          export function App() {
            return <div>{logo}</div>;
          }`
    );
    await preview.show("src/App.tsx:App");
    await preview.expectLoggedMessages.toMatch([
      `Failed to resolve import "some-module" from "src${path.sep}App.tsx". Does the file exist?`,
      "Failed to fetch dynamically imported module",
      "Failed to fetch dynamically imported module",
    ]);
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "./logo.svg";

          export function App() {
            return <div id="recovered">{logo}</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when encountering broken module imports after update", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "some-module";

          export function App() {
            return <div>{logo}</div>;
          }`
    );
    await preview.expectLoggedMessages.toMatch([
      `Failed to resolve import "some-module" from "src${path.sep}App.tsx". Does the file exist?`,
      "Failed to reload /src/App.tsx.",
    ]);
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "./logo.svg";

          export function App() {
            return <div id="recovered">{logo}</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when encountering broken local imports before update", async (preview) => {
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "./missing.svg";

          export function App() {
            return <div>{logo}</div>;
          }`
    );
    await preview.show("src/App.tsx:App");
    await preview.expectLoggedMessages.toMatch([
      `Failed to resolve import "./missing.svg" from "src${path.sep}App.tsx". Does the file exist?`,
      "Failed to fetch dynamically imported module",
      "Failed to fetch dynamically imported module",
    ]);
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "./logo.svg";

          export function App() {
            return <div id="recovered">{logo}</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when encountering broken local imports after update", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "./missing.svg";

          export function App() {
            return <div>{logo}</div>;
          }`
    );
    await preview.expectLoggedMessages.toMatch([
      `Failed to resolve import "./missing.svg" from "src${path.sep}App.tsx". Does the file exist?`,
      "Failed to reload /src/App.tsx.",
    ]);
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "./logo.svg";

          export function App() {
            return <div id="recovered">{logo}</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when encountering broken CSS imports before update", async (preview) => {
    await preview.fileManager.update("src/App.tsx", {
      replace: "App.css",
      with: "App-missing.css",
    });
    await preview.show("src/App.tsx:App");
    await preview.expectLoggedMessages.toMatch([
      "Failed to fetch dynamically imported module",
      "Failed to fetch dynamically imported module",
    ]);
    await preview.fileManager.update("src/App.tsx", {
      replace: "App-missing.css",
      with: "App.css",
    });
    await preview.iframe.waitForSelector(".App");
  });

  test("fails correctly when encountering broken CSS imports after update", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update("src/App.tsx", {
      replace: "App.css",
      with: "App-missing.css",
    });
    await preview.expectLoggedMessages.toMatch([
      "Failed to reload /src/App.tsx.",
    ]);
    await preview.fileManager.update("src/App.tsx", {
      replace: "App-missing.css",
      with: "App.css",
    });
    await preview.iframe.waitForSelector(".App");
  });

  test("fails correctly when encountering broken syntax (case 1)", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/App.tsx",
      `export function App() {
            return <divBroken</div>;
          }`
    );
    await preview.expectLoggedMessages.toMatch([
      "App.tsx: Unexpected token (2:29)",
      "Failed to reload /src/App.tsx.",
    ]);
    await preview.fileManager.update(
      "src/App.tsx",
      `export function App() {
            return <div id="recovered">Fixed</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when encountering broken syntax (case 2)", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/App.tsx",
      `export function App() {
            return <ul>
              <li id="recovered">Broken</li
            </ul>
          }`
    );
    await preview.expectLoggedMessages.toMatch([
      `App.tsx: Unexpected token, expected "jsxTagEnd"`,
      "Failed to reload /src/App.tsx.",
    ]);
    await preview.fileManager.update(
      "src/App.tsx",
      `export function App() {
            return <div id="recovered">Fixed</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when encountering broken logic", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/App.tsx",
      `export function App() {
            if (true) {
              throw new Error("Expected error");
            }
            return <div>Broken</div>;
          }`
    );
    await preview.expectLoggedMessages.toMatch(["Error: Expected error"]);
    await preview.fileManager.update(
      "src/App.tsx",
      `export function App() {
            return <div id="recovered">Fixed</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when encountering broken logic in imported module", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/Dependency.tsx",
      `throw new Error("Expected error");

          export const Dependency = () => {
            return <div>Hello, World!</div>;
          }`
    );
    await preview.expectLoggedMessages.toMatch([
      "Expected error",
      "Failed to reload /src/App.tsx.",
    ]);
    await preview.fileManager.update(
      "src/Dependency.tsx",
      `export const Dependency = () => {
            return <div id="recovered">Hello, World!</div>;
          }`
    );
    await preview.iframe.waitForSelector("#recovered");
  });

  test("fails correctly when file is missing after update", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.rename("src/App.tsx", "src/App-renamed.tsx");
    await preview.expectLoggedMessages.toMatch([
      "Failed to reload /src/App.tsx.",
    ]);
  });

  test("fails correctly when component is missing after update", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/App.tsx",
      `export const App2 = () => <div>Hello, World!</div>;`
    );
    await preview.expectLoggedMessages.toMatch([
      "Error: No component named 'App'",
    ]);
  });

  test("fails correctly when encountering broken CSS", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update("src/App.css", {
      replace: " {",
      with: " BROKEN",
    });
    // We don't expect to see any errors for pure CSS.
    await preview.expectLoggedMessages.toMatch([]);
    await preview.fileManager.update("src/App.css", {
      replace: " BROKEN",
      with: " {",
    });
    await preview.iframe.waitForSelector(".App");
  });
});

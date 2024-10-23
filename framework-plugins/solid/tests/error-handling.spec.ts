import { test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "solid");

test.describe.parallel("solid/error handling", () => {
  const test = previewTest(pluginFactory, testApp);

  test("handles syntax errors gracefully", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update("src/App.tsx", {
      replace: /<p>/g,
      with: "<p",
    });
    await preview.expectErrors.toMatch([
      `src${path.sep}App.tsx: Unexpected token`,
    ]);
    await preview.expectLoggedMessages.toMatch([]);
    // The component should still be shown.

    // TODO: Re-enable this part of the test, which is currently failing because the whole page
    // is reloaded.
    // await preview.iframe.waitForSelector(".App");
  });

  test("fails correctly when encountering broken module imports before update", async (preview) => {
    await preview.fileManager.update(
      "src/App.tsx",
      `import logo from "some-module";

          export function App() {
            return <div>{logo}</div>;
          }`
    );
    await preview.show("src/App.tsx:App").catch(() => {
      /* expected error */
    });
    await preview.expectErrors.toMatch([
      `Failed to resolve import "some-module" from "src/App.tsx". Does the file exist?`,
    ]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.expectErrors.toMatch([
      `Failed to resolve import "some-module" from "src/App.tsx". Does the file exist?`,
    ]);
    await preview.expectLoggedMessages.toMatch([]);
    await new Promise((resolve) => setTimeout(resolve, 5_000));
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
    await preview.show("src/App.tsx:App").catch(() => {
      /* expected error */
    });
    await preview.expectErrors.toMatch([
      `Failed to resolve import "./missing.svg" from "src/App.tsx". Does the file exist?`,
    ]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.expectErrors.toMatch([
      `Failed to resolve import "./missing.svg" from "src/App.tsx". Does the file exist?`,
    ]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.show("src/App.tsx:App").catch(() => {
      /* expected error */
    });
    await preview.expectErrors.toMatch([
      "Failed to load url /src/App-missing.css",
    ]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.expectErrors.toMatch([]);
    await preview.expectLoggedMessages.toMatch([]);
    await preview.fileManager.update("src/App.tsx", {
      replace: "App-missing.css",
      with: "App.css",
    });

    // TODO: Re-enable this part of the test, which is currently failing because the whole page
    // remains broken.
    // await preview.iframe.waitForSelector(".App");
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
    await preview.expectErrors.toMatch(["App.tsx: Unexpected token (2:29)"]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.expectErrors.toMatch([
      `App.tsx: Unexpected token, expected "jsxTagEnd"`,
    ]);
    await preview.expectLoggedMessages.toMatch([]);
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
    await preview.expectErrors.toMatch(["Expected error"]);
    await preview.expectLoggedMessages.toMatch([]);
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
      `
        export const Dependency = () => {
          if (true) {
            throw new Error("Expected error");
          }
          return <div>Hello, World!</div>;
        }`
    );
    await preview.expectErrors.toMatch(["Expected error"]);
    await preview.expectLoggedMessages.toMatch([]);
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
    // TODO: Find a way to prevent silent failures.
    await preview.expectErrors.toMatch([]);
    await preview.expectLoggedMessages.toMatch([]);
  });

  test("fails correctly when component is missing after update", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update(
      "src/App.tsx",
      `export const App2 = () => <div>Hello, World!</div>;`
    );
    // TODO: Find a way to prevent silent failures.
    await preview.expectErrors.toMatch([]);
    await preview.expectLoggedMessages.toMatch([]);
  });

  test("fails correctly when encountering broken CSS", async (preview) => {
    await preview.show("src/App.tsx:App");
    await preview.iframe.waitForSelector(".App");
    await preview.fileManager.update("src/App.css", {
      replace: " {",
      with: " BROKEN",
    });
    // We don't expect to see any errors for pure CSS.
    await preview.expectErrors.toMatch([]);
    await preview.expectLoggedMessages.toMatch([]);
    await preview.fileManager.update("src/App.css", {
      replace: " BROKEN",
      with: " {",
    });
    await preview.iframe.waitForSelector(".App");
  });
});

import path from "path";
import { expect, testSuite } from "../../testing";

export const errorHandlingTests = testSuite("react/error handling", (test) => {
  test(
    "handles syntax errors gracefully when props untouched",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update("src/App.tsx", {
        kind: "edit",
        search: /<p>/g,
        replace: "<p",
      });
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Transform failed with 1 error`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toContain(
        `src${path.sep}App.tsx:24:15: ERROR: Expected ">" but found "<"`
      );
      // The component should still be shown.
      await previewIframe.waitForSelector(".App-logo");
    }
  );

  test(
    "handles syntax errors gracefully when props updated",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await controller.props.editor.isReady();
      await controller.props.editor.replaceText(`
      properties = { foo: "bar" };
      `);
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update("src/App.tsx", {
        kind: "edit",
        search: /<p>/g,
        replace: "<p",
      });
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Transform failed with 1 error`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toContain(
        `src${path.sep}App.tsx:24:15: ERROR: Expected ">" but found "<"`
      );
      // The component should still be shown.
      await previewIframe.waitForSelector(".App-logo");
    }
  );

  test(
    "fails correctly when encountering broken imports",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `import logo from "./missing.svg";

        export function App() {
          return <div>{logo}</div>;
        }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Failed to resolve import "./missing.svg" from "src${path.sep}App.tsx". Does the file exist?`
      );
      expect(await controller.errors.suggestionLink.text()).toEqual(
        " Show me how to configure aliases"
      );
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `import logo from "./logo.svg";

          export function App() {
            return <div id="recovered">{logo}</div>;
          }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await controller.errors.title.waitUntilGone();
      await previewIframe.waitForSelector("#recovered");
    }
  );

  test(
    "fails correctly when encountering broken syntax (case 1)",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `export function App() {
              return <divBroken</div>;
            }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Transform failed with 1 error`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toContain(
        `src${path.sep}App.tsx:2:32: ERROR: Unexpected "/"`
      );
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `export function App() {
              return <div id="recovered">Fixed</div>;
            }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await controller.errors.title.waitUntilGone();
      await previewIframe.waitForSelector("#recovered");
    }
  );

  test(
    "fails correctly when encountering broken syntax (case 2)",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `export function App() {
          return <ul>
            <li id="recovered">Broken</li
          </ul>
        }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Transform failed with 1 error`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toContain(
        `src${path.sep}App.tsx:4:10: ERROR: Expected ">" but found "<"`
      );
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `export function App() {
          return <ul>
            <li id="recovered">Fixed</li>
          </ul>;
        }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await controller.errors.title.waitUntilGone();
      await previewIframe.waitForSelector("#recovered");
    }
  );

  test(
    "fails correctly when encountering broken logic",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `export function App() {
          if (true) {
            throw new Error("Expected error");
          }
          return <div>Broken</div>;
        }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        "Error: Expected error"
      );
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `export function App() {
          return <div id="recovered">Fixed</div>;
        }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await controller.errors.title.waitUntilGone();
      await previewIframe.waitForSelector("#recovered");
    }
  );

  test(
    "fails correctly when encountering broken logic in imported module",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update(
        "src/Dependency.tsx",
        {
          kind: "replace",
          text: `throw new Error("Expected error");
          
          export const Dependency = () => {
            return <div>Hello, World!</div>;
          }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual("Expected error");
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toContain(
        `/preview/src/Dependency.tsx`
      );
      await appDir.update(
        "src/Dependency.tsx",
        {
          kind: "replace",
          text: `export const Dependency = () => {
            return <div id="recovered">Hello, World!</div>;
          }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await controller.errors.title.waitUntilGone();
      await previewIframe.waitForSelector("#recovered");
    }
  );

  test(
    "fails correctly when encountering broken CSS",
    "react",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update("src/App.css", {
        kind: "edit",
        search: " {",
        replace: " BROKEN",
      });
      await sleep(2);
      // We don't expect to see any errors for pure CSS.
      await controller.errors.title.waitUntilGone();
      await appDir.update("src/App.css", {
        kind: "edit",
        search: " BROKEN",
        replace: " {",
      });
      await controller.errors.title.waitUntilGone();
    }
  );

  test(
    "fails correctly when encountering broken SASS",
    "react-sass",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update("src/App.scss", {
        kind: "edit",
        search: " {",
        replace: " BROKEN",
      });
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(`expected "{"`);
      await controller.errors.title.click();
      expect(
        (await controller.errors.details.text())
          ?.replace(/\r/g, "")
          .replace(/\\/g, "/")
      ).toContain(`  ╷
4 │   text-align: center;
  │                     ^
  ╵
  src/App.scss 4:21  root stylesheet`);
      await appDir.update("src/App.scss", {
        kind: "edit",
        search: " BROKEN",
        replace: " {",
      });
      await controller.errors.title.waitUntilGone();
    }
  );

  test(
    "notifies the user when server is not reachable",
    "react",
    async ({ controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await controller.stop();
      await controller.errors.appError.waitUntilVisible();
      expect(await controller.errors.appError.text()).toEqual(
        "Server disconnected. Is Preview.js still running?"
      );
      await controller.start();
      await controller.errors.appError.waitUntilGone();
    }
  );
});

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

import path from "path";
import { expect, testSuite } from "../../testing";

export const errorHandlingTests = testSuite("solid/error handling", (test) => {
  test(
    "handles syntax errors gracefully when props untouched",
    "solid",
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
        `src${path.sep}App.tsx:21:15: ERROR: Expected ">" but found "<"`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toStartWith(
        `Error in src${path.sep}App.tsx:21:15\n`
      );
      // The component should still be shown.
      await previewIframe.waitForSelector(".App-logo");
    }
  );

  test(
    "handles syntax errors gracefully when props updated",
    "solid",
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
        `src${path.sep}App.tsx:21:15: ERROR: Expected ">" but found "<"`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toStartWith(
        `Error in src${path.sep}App.tsx:21:15\n`
      );
      // The component should still be shown.
      await previewIframe.waitForSelector(".App-logo");
    }
  );

  test(
    "fails correctly when encountering broken module imports before update",
    "solid",
    async ({ appDir, controller }) => {
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `import logo from "some-module";

        export function App() {
          return <div>{logo}</div>;
        }`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Failed to resolve import "some-module" from "src${path.sep}App.tsx". Does the file exist?`
      );
      expect(await controller.errors.suggestion.text()).toEqual(
        ` Perhaps you need to install "some-module" or configure aliases?`
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
    "fails correctly when encountering broken module imports after update",
    "solid",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update(
        "src/App.tsx",
        {
          kind: "replace",
          text: `import logo from "some-module";

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
        `Failed to resolve import "some-module" from "src${path.sep}App.tsx". Does the file exist?`
      );
      expect(await controller.errors.suggestion.text()).toEqual(
        ` Perhaps you need to install "some-module" or configure aliases?`
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
    "fails correctly when encountering broken local imports before update",
    "solid",
    async ({ appDir, controller }) => {
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
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Failed to resolve import "./missing.svg" from "src${path.sep}App.tsx". Does the file exist?`
      );
      expect(await controller.errors.suggestion.text()).toEqual(
        " Perhaps you need to install a peer dependency or configure aliases?"
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
    "fails correctly when encountering broken local imports after update",
    "solid",
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
      expect(await controller.errors.suggestion.text()).toEqual(
        " Perhaps you need to install a peer dependency or configure aliases?"
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
    "fails correctly when encountering broken CSS imports before update",
    "solid",
    async ({ appDir, controller }) => {
      await appDir.update("src/App.tsx", {
        kind: "edit",
        search: "App.css",
        replace: "App-missing.css",
      });
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toStartWith(
        `TypeError: Failed to fetch dynamically imported module`
      );
      await appDir.update("src/App.tsx", {
        kind: "edit",
        search: "App-missing.css",
        replace: "App.css",
      });
      await controller.errors.title.waitUntilGone();
      await previewIframe.waitForSelector(".App-logo");
    }
  );

  test(
    "fails correctly when encountering broken CSS imports after update",
    "solid",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update("src/App.tsx", {
        kind: "edit",
        search: "App.css",
        replace: "App-missing.css",
      });
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Failed to reload /src/App.tsx. This could be due to syntax errors or importing non-existent modules.`
      );
      await appDir.update("src/App.tsx", {
        kind: "edit",
        search: "App-missing.css",
        replace: "App.css",
      });
      await controller.errors.title.waitUntilGone();
      await previewIframe.waitForSelector(".App-logo");
    }
  );

  test(
    "fails correctly when encountering broken syntax (case 1)",
    "solid",
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
        `src${path.sep}App.tsx:2:32: ERROR: Unexpected "/"`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toStartWith(
        `Error in src${path.sep}App.tsx:2:32\n`
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
    "solid",
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
        `src${path.sep}App.tsx:4:10: ERROR: Expected ">" but found "<"`
      );
      await controller.errors.title.click();
      expect(await controller.errors.details.text()).toStartWith(
        `Error in src${path.sep}App.tsx:4:10\n`
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
    "solid",
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
    "solid",
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
    "solid",
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
    "shows error when file is missing before update",
    "solid",
    async ({ controller }) => {
      await controller.show("src/App-missing.tsx:App");
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toStartWith(
        `Failed to resolve import "/src/App-missing.tsx"`
      );
    }
  );

  test(
    "shows error when file is missing after update",
    "solid",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.rename("src/App.tsx", "src/App-renamed.tsx");
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Failed to reload /src/App.tsx. This could be due to syntax errors or importing non-existent modules.`
      );
    }
  );

  // TODO: Add this test once we find a way to catch the error message
  // which is logged immediately after Vite is connected, before the
  // preview iframe is fully initialised.
  //
  //   test(
  //     "shows error when component is missing before update",
  //     "solid",
  //     async ({ appDir, controller }) => {
  //       await appDir.update("src/App.tsx", {
  //         kind: "replace",
  //         text: `
  // export const App2 = () => <div>Hello, World!</div>;`,
  //       });
  //       await controller.show("src/App.tsx:App");
  //       await controller.errors.title.waitUntilVisible();
  //       expect(await controller.errors.title.text()).toEqual(
  //         `Error: No component named 'App'`
  //       );
  //     }
  //   );

  test(
    "shows error when component is missing after update",
    "solid",
    async ({ appDir, controller }) => {
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update("src/App.tsx", {
        kind: "replace",
        text: `
export const App2 = () => <div>Hello, World!</div>;`,
      });
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Error: No component named 'App'`
      );
    }
  );

  test(
    "notifies the user when server is not reachable",
    "solid",
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

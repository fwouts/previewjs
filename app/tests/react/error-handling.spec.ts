import path from "path";
import { expect, testSuite } from "../../testing";
import { expectErrors } from "../../testing/helpers/expect-errors";

export const errorHandlingTests = testSuite("react/error handling", (test) => {
  for (const version of [16, 17, 18]) {
    test(
      `${version}/handles syntax errors gracefully when props untouched`,
      `react${version}`,
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await appDir.update("src/App.tsx", {
          kind: "edit",
          search: /<p>/g,
          replace: "<p",
        });
        await expectErrors(controller, [
          `src/App.tsx:24:15: ERROR: Expected ">" but found "<"`,
          "Failed to reload /src/App.tsx.",
        ]);
        // The component should still be shown.
        await previewIframe.waitForSelector(".App-logo");
      }
    );

    test(
      `${version}/handles syntax errors gracefully when props updated`,
      `react${version}`,
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
        await expectErrors(controller, [
          `src/App.tsx:24:15: ERROR: Expected ">" but found "<"`,
          "Failed to reload /src/App.tsx.",
        ]);
        // The component should still be shown.
        await previewIframe.waitForSelector(".App-logo");
      }
    );

    test(
      `${version}/fails correctly when encountering broken module imports before update`,
      `react${version}`,
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
        await expectErrors(controller, [
          `Failed to resolve import "some-module" from "src${path.sep}App.tsx". Does the file exist?`,
          "Failed to fetch dynamically imported module",
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken module imports after update`,
      `react${version}`,
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
        await expectErrors(controller, [
          `Failed to resolve import "some-module" from "src${path.sep}App.tsx". Does the file exist?`,
          "Failed to reload /src/App.tsx.",
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken local imports before update`,
      `react${version}`,
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
        await expectErrors(controller, [
          `Failed to resolve import "./missing.svg" from "src${path.sep}App.tsx". Does the file exist?`,
          "Failed to fetch dynamically imported module",
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken local imports after update`,
      `react${version}`,
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
        await expectErrors(controller, [
          `Failed to resolve import "./missing.svg" from "src${path.sep}App.tsx". Does the file exist?`,
          "Failed to reload /src/App.tsx.",
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken CSS imports before update`,
      `react${version}`,
      async ({ appDir, controller }) => {
        await appDir.update("src/App.tsx", {
          kind: "edit",
          search: "App.css",
          replace: "App-missing.css",
        });
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await expectErrors(controller, [
          "Failed to fetch dynamically imported module",
        ]);
        await appDir.update("src/App.tsx", {
          kind: "edit",
          search: "App-missing.css",
          replace: "App.css",
        });
        await expectErrors(controller, []);
        await previewIframe.waitForSelector(".App-logo");
      }
    );

    test(
      `${version}/fails correctly when encountering broken CSS imports after update`,
      `react${version}`,
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await appDir.update("src/App.tsx", {
          kind: "edit",
          search: "App.css",
          replace: "App-missing.css",
        });
        await expectErrors(controller, ["Failed to reload /src/App.tsx."]);
        await appDir.update("src/App.tsx", {
          kind: "edit",
          search: "App-missing.css",
          replace: "App.css",
        });
        await expectErrors(controller, []);
        await previewIframe.waitForSelector(".App-logo");
      }
    );

    test(
      `${version}/fails correctly when encountering broken syntax (case 1)`,
      `react${version}`,
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
        await expectErrors(controller, [
          `src/App.tsx:2:32: ERROR: Unexpected "/"`,
          "Failed to reload /src/App.tsx.",
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken syntax (case 2)`,
      `react${version}`,
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
        await expectErrors(controller, [
          `src/App.tsx:4:10: ERROR: Expected ">" but found "<"`,
          "Failed to reload /src/App.tsx.",
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken logic`,
      `react${version}`,
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
        await expectErrors(controller, [
          "Error: Expected error",
          "Consider adding an error boundary",
          ...(version === 18 ? ["Error: Expected error"] : []),
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken logic in imported module`,
      `react${version}`,
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
        await expectErrors(controller, [
          ["Expected error", "src/Dependency.tsx"],
          "Failed to reload /src/App.tsx.",
        ]);
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
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#recovered");
      }
    );

    test(
      `${version}/fails correctly when encountering broken CSS`,
      `react${version}`,
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
        await expectErrors(controller, []);
        await appDir.update("src/App.css", {
          kind: "edit",
          search: " BROKEN",
          replace: " {",
        });
        await expectErrors(controller, []);
      }
    );

    test(
      `${version}/fails correctly when encountering broken SASS`,
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
        await expectErrors(controller, [
          [
            `expected "{"`,
            `4 │   text-align: center;
  │                     ^
  ╵
  src${path.sep}App.scss 4:21  root stylesheet`,
          ],
          "Failed to reload /src/App.scss.",
        ]);
        await appDir.update("src/App.scss", {
          kind: "edit",
          search: " BROKEN",
          replace: " {",
        });
        await expectErrors(controller, []);
      }
    );

    test(
      `${version}/shows error when file is missing before update`,
      `react${version}`,
      async ({ controller }) => {
        await controller.show("src/App-missing.tsx:App");
        await expectErrors(controller, [
          `Failed to resolve import "/src/App-missing.tsx"`,
          "Failed to fetch dynamically imported module",
        ]);
      }
    );

    test(
      `${version}/shows error when file is missing after update`,
      `react${version}`,
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await appDir.rename("src/App.tsx", "src/App-renamed.tsx");
        await expectErrors(controller, [
          `Failed to reload /src/App.tsx. This could be due to syntax errors or importing non-existent modules.`,
        ]);
      }
    );

    test(
      `${version}/shows error when component is missing before update`,
      `react${version}`,
      async ({ appDir, controller }) => {
        await appDir.update("src/App.tsx", {
          kind: "replace",
          text: `import React from 'react';

    export const App2 = () => <div>Hello, World!</div>;`,
        });
        await controller.show("src/App.tsx:App");
        await expectErrors(controller, [`Error: No component named 'App'`]);
      }
    );

    test(
      `${version}/shows error when component is missing after update`,
      `react${version}`,
      async ({ appDir, controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await appDir.update("src/App.tsx", {
          kind: "replace",
          text: `import React from 'react';

    export const App2 = () => <div>Hello, World!</div>;`,
        });
        await expectErrors(controller, [`Error: No component named 'App'`]);
      }
    );

    test(
      `${version}/notifies the user when server is not reachable`,
      `react${version}`,
      async ({ controller }) => {
        await controller.show("src/App.tsx:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".App-logo");
        await controller.stop();
        await controller.appError.waitUntilVisible();
        expect(await controller.appError.text()).toEqual(
          "Server disconnected. Is Preview.js still running?"
        );
        await controller.start();
        await controller.appError.waitUntilGone();
      }
    );
  }
});

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

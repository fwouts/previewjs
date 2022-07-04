import { expect, expectErrors } from "@previewjs/e2e-test-runner";
import solidPlugin from "@previewjs/plugin-solid";
import path from "path";
import { describe, it } from "vitest";

describe("solid/error handling", () => {
  it("handles syntax errors gracefully when props untouched", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await appDir.update("src/App.tsx", {
      kind: "edit",
      search: /<p>/g,
      replace: "<p",
    });
    await expectErrors(controller, [
      `src${path.sep}App.tsx: Unexpected token`,
      "Failed to reload /src/App.tsx.",
    ]);
    // The component should still be shown.
    await previewIframe.waitForSelector(".App-logo");
  });

  it("handles syntax errors gracefully when props updated", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
      `src${path.sep}App.tsx: Unexpected token`,
      "Failed to reload /src/App.tsx.",
    ]);
    // The component should still be shown.
    await previewIframe.waitForSelector(".App-logo");
  });

  it("fails correctly when encountering broken module imports before update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("fails correctly when encountering broken module imports after update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("fails correctly when encountering broken local imports before update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("fails correctly when encountering broken local imports after update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("fails correctly when encountering broken CSS imports before update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("fails correctly when encountering broken CSS imports after update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("fails correctly when encountering broken syntax (case 1)", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
      `src${path.sep}App.tsx: Unexpected token`,
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
  });

  it("fails correctly when encountering broken syntax (case 2)", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
      `src${path.sep}App.tsx: Unexpected token, expected "jsxTagEnd"`,
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
  });

  it("fails correctly when encountering broken logic", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
    await expectErrors(controller, ["Error: Expected error"]);
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
  });

  it("fails correctly when encountering broken logic in imported module", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("fails correctly when encountering broken CSS", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });

  it("shows error when file is missing before update", async (ctx) => {
    const { controller } = await ctx.setupTest("solid", [solidPlugin]);
    await controller.show("src/App-missing.tsx:App");
    await expectErrors(controller, [
      `Failed to resolve import "/src/App-missing.tsx"`,
      "Failed to fetch dynamically imported module",
    ]);
  });

  it("shows error when file is missing after update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await appDir.rename("src/App.tsx", "src/App-renamed.tsx");
    await expectErrors(controller, [
      `Failed to reload /src/App.tsx. This could be due to syntax errors or importing non-existent modules.`,
    ]);
  });

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
  //       await expectErrors(controller, [`Error: No component named 'App'`]);
  //     }
  //   );

  it("shows error when component is missing after update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await appDir.update("src/App.tsx", {
      kind: "replace",
      text: `
export const App2 = () => <div>Hello, World!</div>;`,
    });
    await expectErrors(controller, [`Error: No component named 'App'`]);
  });

  it("notifies the user when server is not reachable", async (ctx) => {
    const { controller } = await ctx.setupTest("solid", [solidPlugin]);
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
  });
});

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

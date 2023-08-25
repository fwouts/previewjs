import { test } from "@playwright/test";
import type { PreviewServer, Workspace } from "@previewjs/core";
import { createWorkspace, setupFrameworkPlugin } from "@previewjs/core";
import "@previewjs/iframe";
import frameworkPluginFactory from "@previewjs/plugin-react";
import { createFileSystemReader } from "@previewjs/vfs";
import path from "path";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import ts from "typescript";
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

test.describe("navigation", () => {
  let workspace: Workspace;
  let previewServer: PreviewServer;

  test.beforeAll(async () => {
    // TODO: Simplify syntax drastically.
    const rootDir = path.join(__dirname, "..");
    const logger = createLogger(
      { level: "debug" },
      prettyLogger({ colorize: true })
    );
    const reader = createFileSystemReader();
    const frameworkPlugin = await setupFrameworkPlugin({
      rootDir,
      frameworkPlugins: [frameworkPluginFactory],
      logger,
      reader,
    });
    if (!frameworkPlugin) {
      throw new Error(`Unable to initialize framework plugin`);
    }
    workspace = await createWorkspace({
      rootDir,
      frameworkPlugin,
      logger,
      reader,
      onServerStart: () =>
        Promise.resolve({
          middlewares: [
            (req, res, next) => {
              if (req.path === "/") {
                res.end();
              } else {
                next();
              }
            },
          ],
        }),
    });
    previewServer = await workspace.startServer();
  });

  test.afterAll(async () => {
    await previewServer.stop();
    await workspace.dispose();
  });

  test("foo", async ({ page }) => {
    // TODO: Use detected previewable ID.
    const previewableId = "src/App.tsx:App";
    const url = `${previewServer.url()}/preview/${previewableId}/`;
    await page.exposeFunction("onPreviewMessage", (message) => {
      console.error(message);
    });
    await page.goto(url);
    await page.waitForLoadState("networkidle");
    // console.error(url);
    // await new Promise(() => {});
    const propsAssignmentSource = transpile(`
    const { Foo } = await import("./Foo.tsx");
    
    properties = {
      title: <Foo />
    };`);
    await page.evaluate(
      async ([previewableId, propsAssignmentSource]) => {
        // TODO: Pass actual values instead of code, since this is local?
        await window.__PREVIEWJS_IFRAME__.render({
          previewableId,
          autogenCallbackPropsSource: "",
          propsAssignmentSource,
        });
      },
      [previewableId, propsAssignmentSource]
    );
    // await new Promise(() => {});
    await page.screenshot({
      path: "result.png",
    });
  });
});

// TODO: Abstract this away (also in chromeless?).
function transpile(source: string) {
  // Transform JSX if required.
  try {
    return ts.transpileModule(source, {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
        jsxFactory: "__jsxFactory__",
      },
    }).outputText;
  } catch (e) {
    throw new Error(`Error transforming source:\n${source}\n\n${e}`);
  }
}

import { Page, test } from "@playwright/test";
import type { PreviewServer, Workspace } from "@previewjs/core";
import { createWorkspace } from "@previewjs/core";
import "@previewjs/iframe";
import frameworkPluginFactory from "@previewjs/plugin-react";
import path from "path";
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

test.describe("navigation", () => {
  let workspace: Workspace;
  let previewServer: PreviewServer;

  test.beforeAll(async () => {
    const rootDir = path.join(__dirname, "..");
    workspace = await createWorkspace({
      rootDir,
      frameworkPlugins: [frameworkPluginFactory],
    });
    previewServer = await workspace.startServer();
  });

  test.afterAll(async () => {
    await workspace.dispose();
  });

  test("foo", async ({ page }) => {
    await runInPage(workspace, page, __dirname, async () => {
      const { default: App } = await import("./App");
      const { Foo } = await import("./Foo");

      await mount(<App title={<Foo />} />);
    });

    await page.screenshot({
      path: "src/example.spec.output.png",
    });
  });

  async function runInPage(
    workspace: Workspace,
    page: Page,
    currentDir: string,
    pageFunction: () => Promise<void>
  ) {
    let resolvePromise!: () => void;
    const onRenderDone = new Promise<void>((resolve) => {
      resolvePromise = resolve;
    });
    await page.exposeFunction("__ON_PREVIEWJS_MOUNTED__", resolvePromise);
    await page.exposeFunction("__PREVIEWJS_BOOSTRAP_HOOK__", async () => {
      await page.evaluate(
        async ([pageFunctionStr]) => {
          const pageFunction = eval(pageFunctionStr);
          await pageFunction();
          // @ts-expect-error
          window.__ON_PREVIEWJS_MOUNTED__();
        },
        [pageFunction.toString()]
      );
    });
    await page.goto(getUrl(workspace, currentDir));
    await onRenderDone;
  }

  function getUrl(workspace: Workspace, currentDir: string) {
    const currentPath = path
      .relative(workspace.rootDir, currentDir)
      .replaceAll(path.delimiter, "/");
    return `${previewServer.url()}/${currentPath}/`;
  }
});

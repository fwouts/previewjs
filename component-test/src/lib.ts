import { test as base } from "@playwright/test";
import type { PreviewServer, Workspace } from "@previewjs/core";
import { createWorkspace } from "@previewjs/core";
import "@previewjs/iframe";
import frameworkPluginFactory from "@previewjs/plugin-react";
import path from "path";

export function previewjsFixture(rootDir: string) {
  return base.extend<
    {
      runInPage(
        currentDir: string,
        pageFunction: () => Promise<void>
      ): Promise<void>;
      runInPage<Arg>(
        currentDir: string,
        pageFunction: (arg: Arg) => Promise<void>,
        arg: Arg
      ): Promise<void>;
    },
    { previewServer: PreviewServer; previewWorkspace: Workspace }
  >({
    previewWorkspace: [
      // eslint-disable-next-line no-empty-pattern
      async ({}, use) => {
        const workspace = await createWorkspace({
          rootDir,
          frameworkPlugins: [frameworkPluginFactory],
        });
        await use(workspace);
        await workspace.dispose();
      },
      { scope: "worker" },
    ],
    previewServer: [
      async ({ previewWorkspace }, use) => {
        const previewServer = await previewWorkspace.startServer();
        await use(previewServer);
        await previewServer.stop();
      },
      { scope: "worker" },
    ],
    runInPage: async ({ previewWorkspace, previewServer, page }, use) => {
      use(async function runInPage<Arg = never>(
        currentDir: string,
        pageFunction: (arg: Arg) => Promise<void>,
        arg?: Arg
      ): Promise<void> {
        let resolvePromise!: () => void;
        const onRenderDone = new Promise<void>((resolve) => {
          resolvePromise = resolve;
        });
        await page.exposeFunction("__ON_PREVIEWJS_MOUNTED__", resolvePromise);
        await page.exposeFunction("__PREVIEWJS_BOOSTRAP_HOOK__", async () => {
          await page.evaluate(
            async ([pageFunctionStr, arg]) => {
              const pageFunction = eval(pageFunctionStr);
              await pageFunction(arg);
              // @ts-expect-error
              window.__ON_PREVIEWJS_MOUNTED__();
            },
            [pageFunction.toString(), arg] as const
          );
        });
        await page.goto(getUrl(previewWorkspace, currentDir));
        await onRenderDone;
      });

      function getUrl(workspace: Workspace, currentDir: string) {
        const currentPath = path
          .relative(workspace.rootDir, currentDir)
          .replaceAll(path.delimiter, "/");
        return `${previewServer.url()}/${currentPath}/`;
      }
    },
  });
}

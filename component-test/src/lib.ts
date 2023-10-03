import { test as base } from "@playwright/test";
import type {
  FrameworkPluginFactory,
  PreviewServer,
  Workspace,
} from "@previewjs/core";
import { createWorkspace } from "@previewjs/core";
import "@previewjs/iframe";
import path from "path";

let cache: Map<
  FrameworkPluginFactory,
  ReturnType<typeof createTest>
> = new Map();

export function setupTest(frameworkPluginFactory: FrameworkPluginFactory) {
  const cached = cache.get(frameworkPluginFactory);
  if (cached !== undefined) {
    return cached;
  }
  const test = createTest(frameworkPluginFactory);
  cache.set(frameworkPluginFactory, test);
  return test;
}

function createTest(frameworkPluginFactory: FrameworkPluginFactory) {
  return base.extend<
    {
      runInPage(pageFunction: () => Promise<void>): Promise<void>;
      runInPage<Arg>(
        pageFunction: (arg: Arg) => Promise<void>,
        arg: Arg
      ): Promise<void>;
    },
    { previewServer: PreviewServer; previewWorkspace: Workspace }
  >({
    previewWorkspace: [
      // eslint-disable-next-line no-empty-pattern
      async ({}, use, { config }) => {
        const workspace = await createWorkspace({
          rootDir: config.rootDir,
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
    runInPage: async (
      { previewWorkspace, previewServer, page },
      use,
      testInfo
    ) => {
      use(async function runInPage<Arg = never>(
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
        const currentPath = path
          .relative(previewWorkspace.rootDir, path.dirname(testInfo.file))
          .replaceAll(path.delimiter, "/");
        await page.goto(`${previewServer.url()}/${currentPath}/`);
        await onRenderDone;
      });
    },
  });
}
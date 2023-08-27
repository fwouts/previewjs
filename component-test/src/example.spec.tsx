import { test } from "@playwright/test";
import type { PreviewServer, Workspace } from "@previewjs/core";
import { createWorkspace } from "@previewjs/core";
import "@previewjs/iframe";
import frameworkPluginFactory from "@previewjs/plugin-react";
import { createFileSystemReader } from "@previewjs/vfs";
import path from "path";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
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
    workspace = (await createWorkspace({
      rootDir,
      frameworkPlugins: [frameworkPluginFactory],
      logger,
      reader,
    }))!;
    previewServer = await workspace.startServer();
  });

  test.afterAll(async () => {
    await previewServer.stop();
    await workspace.dispose();
  });

  // TODO: Check if the page may reload itself if a new dependency is discovered by Vite.

  test("foo", async ({ page }) => {
    await page.goto(getUrl(workspace, __dirname));
    await page.evaluate(async () => {
      const { default: App } = await import("./App");
      const { Foo } = await import("./Foo");

      await mount(<App title={<Foo />} />);
    });
    await page.screenshot({
      path: "src/example.spec.output.png",
    });
  });

  function getUrl(workspace: Workspace, currentDir: string) {
    const currentPath = path
      .relative(workspace.rootDir, currentDir)
      .replaceAll(path.delimiter, "/");
    return `${previewServer.url()}/${currentPath}/`;
  }
});

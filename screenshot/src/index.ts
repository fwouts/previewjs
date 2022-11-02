import { RPCs } from "@previewjs/api";
import { createWorkspace, loadPreviewEnv } from "@previewjs/core";
import type { PreviewEvent } from "@previewjs/iframe";
import reactFrameworkPlugin from "@previewjs/plugin-react";
import solidFrameworkPlugin from "@previewjs/plugin-solid";
import svelteFrameworkPlugin from "@previewjs/plugin-svelte";
import vue2FrameworkPlugin from "@previewjs/plugin-vue2";
import vue3FrameworkPlugin from "@previewjs/plugin-vue3";
import { generateInvocation } from "@previewjs/properties";
import { createFileSystemReader } from "@previewjs/vfs";
import express from "express";
import fs from "fs";
import path from "path";
import playwright from "playwright";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const rootDirPath = process.env["WORKSPACE_DIR"];
  if (!rootDirPath) {
    throw new Error(`Missing environment variable: WORKSPACE_DIR`);
  }
  const env = await loadPreviewEnv({
    rootDirPath,
    setupEnvironment: async () => ({}),
    frameworkPluginFactories: [
      reactFrameworkPlugin,
      solidFrameworkPlugin,
      svelteFrameworkPlugin,
      vue2FrameworkPlugin,
      vue3FrameworkPlugin,
    ],
  });
  if (!env) {
    throw new Error(
      `No preview environment could be created for directory: ${rootDirPath}`
    );
  }
  const clientDirPath = findClientDir(__dirname);
  const components: Array<{
    filePath: string;
    componentName: string;
    customVariantPropsSource: string;
  }> = [];
  const workspace = await createWorkspace({
    rootDirPath,
    frameworkPlugin: env.frameworkPlugin,
    logLevel: "error",
    versionCode: "0.0.0-dev",
    middlewares: [
      (req, res, next) => {
        if (req.path !== "/") {
          return next();
        }
        const indexHtml = fs.readFileSync(
          path.join(clientDirPath, "index.html"),
          "utf8"
        );
        res.send(
          indexHtml.replace("__COMPONENTS__", JSON.stringify(components))
        );
      },
      express.static(clientDirPath),
    ],
    reader: createFileSystemReader(),
  });
  if (!workspace) {
    throw new Error(
      `No workspace could be created for directory: ${rootDirPath}`
    );
  }
  const found = await workspace.localRpc(RPCs.DetectComponents, {});
  for (const [filePath, fileComponents] of Object.entries(found.components)) {
    for (const component of fileComponents) {
      const properties = await workspace.localRpc(RPCs.ComputeProps, {
        filePath,
        componentName: component.name,
      });
      const invocation = generateInvocation(
        properties.types.props,
        [],
        properties.types.all
      );
      components.push({
        filePath,
        componentName: component.name,
        customVariantPropsSource: invocation,
      });
      // We only need one component for testing here.
      break;
    }
    break;
  }
  const port = 3250;
  await workspace.preview.start(async () => port);
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  page.on("console", console.log);
  await page.goto(`http://localhost:${port}`);
  let onReady: () => void;
  const ready = new Promise<void>((resolve) => {
    onReady = resolve;
  });
  await page.exposeFunction("onIframeEvent", (event: PreviewEvent) => {
    console.log("RECEIVED", event);
    if (event.kind === "rendering-done") {
      onReady();
    }
  });
  await page.evaluate((components) => {
    // @ts-ignore
    window.renderComponent(components[0]);
  }, components);
  console.log("Waiting for ready...");
  await ready;
  console.log("Ready!");
  await page.screenshot({
    path: path.join(__dirname, "screenshot.png"),
  });
  console.log("Screenshot!");
}

function findClientDir(dirPath: string): string {
  const potentialPath = path.join(dirPath, "client", "dist");
  if (fs.existsSync(potentialPath)) {
    return potentialPath;
  } else {
    const parentPath = path.dirname(dirPath);
    if (!parentPath || parentPath === dirPath) {
      throw new Error(`Unable to find compiled client directory (client/dist)`);
    }
    return findClientDir(parentPath);
  }
}

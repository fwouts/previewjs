import { createWorkspace, loadPreviewEnv } from "@previewjs/core";
import reactFrameworkPlugin from "@previewjs/plugin-react";
import solidFrameworkPlugin from "@previewjs/plugin-solid";
import svelteFrameworkPlugin from "@previewjs/plugin-svelte";
import vue2FrameworkPlugin from "@previewjs/plugin-vue2";
import vue3FrameworkPlugin from "@previewjs/plugin-vue3";
import { createFileSystemReader } from "@previewjs/vfs";
import express from "express";
import fs from "fs";
import glob from "glob";
import path from "path";
import { promisify } from "util";

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
    setupEnvironment: async () => ({
      middlewares: [express.static(findClientDir(__dirname))],
    }),
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
  const workspace = await createWorkspace({
    rootDirPath,
    frameworkPlugin: env.frameworkPlugin,
    logLevel: "error",
    versionCode: "0.0.0-dev",
    middlewares: [],
    reader: createFileSystemReader(),
  });
  if (!workspace) {
    throw new Error(
      `No workspace could be created for directory: ${rootDirPath}`
    );
  }
  const absoluteFilePaths = await findFiles(
    rootDirPath,
    "**/*.@(js|jsx|ts|tsx|svelte|vue)"
  );
  const found = await env.frameworkPlugin.detectComponents(
    workspace.typeAnalyzer,
    absoluteFilePaths
  );
  console.error(found);
  await workspace.preview.start(async () => 3250);
}

async function findFiles(rootDirPath: string, pattern: string) {
  const files = await promisify(glob)(pattern, {
    ignore: ["**/node_modules/**"],
    cwd: rootDirPath,
    nodir: true,
    absolute: true,
    follow: false,
  });
  // Note: in some cases, presumably because of yarn using link
  // for faster node_modules, glob may return files in the parent
  // directory. We filter them out here.
  return files.filter((f) =>
    f.startsWith(rootDirPath.replace(/\\/g, "/") + "/")
  );
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

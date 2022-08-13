import { reactFrameworkPlugin } from "@previewjs/plugin-react";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import path from "path";
import { build } from "vite";
import { ViteManager } from "./vite/vite-manager";

async function main() {
  const rootDirPath = "/Users/fwouts/dev/hungry";
  const previewDirPath = path.join(__dirname, "..", "..", "iframe", "preview");
  const frameworkPlugin = await reactFrameworkPlugin.create();
  const transformingReader = createStackedReader([
    createFileSystemReader(),
    createFileSystemReader({
      mapping: {
        from: frameworkPlugin.previewDirPath,
        to: path.join(rootDirPath, "__previewjs_internal__", "renderer"),
      },
      watch: false,
    }),
    createFileSystemReader({
      mapping: {
        from: previewDirPath,
        to: rootDirPath,
      },
      watch: false,
    }),
  ]);
  const viteManager = new ViteManager({
    rootDirPath,
    shadowHtmlFilePath: path.join(
      __dirname,
      "..",
      "iframe",
      "preview",
      "index.html"
    ),
    reader: transformingReader,
    cacheDir: path.join(__dirname, ".build-cache"),
    config: {
      alias: {},
      publicDir: "public",
    },
    detectedGlobalCssFilePaths: ["/Users/fwouts/dev/hungry/styles/globals.css"],
    logLevel: "info",
    frameworkPlugin,
  });
  await build({
    ...(await viteManager.viteConfig()),
    base: "/",
    build: {
      outDir: path.join(__dirname, "..", "built"),
      emptyOutDir: true,
      // minify: false,
    },
    // mode: "development",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};

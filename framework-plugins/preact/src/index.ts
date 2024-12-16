import type { Component, Story } from "@previewjs/analyzer-api";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { createTypeAnalyzer } from "@previewjs/type-analyzer";
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import path from "path";
import ts from "typescript";
import url from "url";
import { crawlFile } from "./crawl-file.js";
import { PREACT_SPECIAL_TYPES } from "./special-types.js";

const preactFrameworkPlugin: FrameworkPluginFactory = {
  info: {
    apiVersion: 5,
    name: "@previewjs/plugin-preact",
  },
  isCompatible: async (dependencies) => {
    const version = await dependencies["preact"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) >= 10;
  },
  async create({ rootDir, reader, logger }) {
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    const typeAnalyzer = createTypeAnalyzer({
      rootDir,
      reader,
      specialTypes: PREACT_SPECIAL_TYPES,
      tsCompilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "preact",
        jsxFactory: "h",
        jsxFragmentFactory: "Fragment",
      },
    });
    return {
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      typeAnalyzer,
      crawlFiles: async (filePaths) => {
        const absoluteFilePaths = filePaths.map((f) =>
          path.isAbsolute(f) ? f : path.join(rootDir, f)
        );
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        const stories: Story[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          for (const previewable of await crawlFile(
            logger,
            resolver,
            rootDir,
            absoluteFilePath
          )) {
            if ("exported" in previewable) {
              components.push(previewable);
            } else {
              stories.push(previewable);
            }
          }
        }
        return {
          components,
          stories,
        };
      },
      viteConfig: (configuredPlugins) => {
        return {
          optimizeDeps: {
            esbuildOptions: {
              plugins: [polyfillNode()],
            },
          },
          resolve: {
            alias: {
              react: "preact/compat",
              "react-dom/test-utils": "preact/test-utils",
              "react-dom": "preact/compat",
              "react/jsx-runtime": "preact/jsx-runtime",
            },
          },
          esbuild: {
            jsx: "automatic",
            jsxImportSource: "preact",
            jsxFactory: "h",
            jsxFragment: "fragment",
          },
          plugins: [
            ...configuredPlugins.filter(
              (plugin) =>
                plugin.name !== "prefresh" && plugin.name !== "vite:preact-jsx"
            ),
            {
              name: "previewjs:optimize-deps",
              config: () => ({
                optimizeDeps: {
                  include: ["preact", "preact/jsx-runtime"],
                },
              }),
            },
          ],
        };
      },
      dispose: () => {
        typeAnalyzer.dispose();
      },
    };
  },
};

export default preactFrameworkPlugin;

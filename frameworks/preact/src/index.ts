import type { Component, FrameworkPluginFactory } from "@previewjs/core";
import path from "path";
import ts from "typescript";
import { PREACT_SPECIAL_TYPES } from "./special-types";
import { extractPreactComponents } from "./extract-component";

const preactFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["preact"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) >= 10;
  },
  async create() {
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-preact",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      specialTypes: PREACT_SPECIAL_TYPES,
      tsCompilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "preact",
      },
      detectComponents: async (typeAnalyzer, absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          components.push(
            ...extractPreactComponents(resolver, absoluteFilePath)
          );
        }
        return components;
      },
      viteConfig: () => {
        return {
          resolve: {
            alias: {
              react: "preact/compat",
              "react-dom/test-utils": "preact/test-utils",
              "react-dom": "preact/compat",
              "react/jsx-runtime": "preact/jsx-runtime",
              "react-native": "preact/compat",
            },
          },
          esbuild: {
            jsx: "automatic",
            jsxImportSource: "preact",
          },
          plugins: [
            {
              name: "previewjs:disable-preact-hmr",
              async transform(code, id) {
                if (!id.endsWith(".jsx") && !id.endsWith(".tsx")) {
                  return null;
                }
                // HMR prevents preview props from being refreshed.
                // For now, we disable it entirely.
                return code.replace(/import\.meta/g, "({})");
              },
            },
            {
              name: "previewjs:optimize-deps",
              config: () => ({
                optimizeDeps: {
                  include: ["preact", "preact/jsx-runtime"],
                },
              }),
            },
          ],
          define: {
            "process.env.RUNNING_INSIDE_PREVIEWJS": "1",
          },
        };
      },
    };
  },
};

export default preactFrameworkPlugin;

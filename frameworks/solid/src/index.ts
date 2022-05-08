import type { Component, FrameworkPluginFactory } from "@previewjs/core";
import path from "path";
import ts from "typescript";
import type { Plugin } from "vite";
import vitePluginSolid from "vite-plugin-solid";
import { extractSolidComponents } from "./extract-component";
import { optimizeSolidDepsPlugin } from "./optimize-deps-plugin";
import { SOLID_SPECIAL_TYPES } from "./special-types";

export const solidFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["solid-js"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) === 1;
  },
  async create() {
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-solid",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      specialTypes: SOLID_SPECIAL_TYPES,
      tsCompilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        jsxImportSource: "solid-js",
      },
      detectComponents: async (typeAnalyzer, absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          components.push(
            ...extractSolidComponents(resolver, absoluteFilePath)
          );
        }
        return components;
      },
      viteConfig: () => {
        return {
          plugins: [
            vitePluginSolid() as Plugin,
            optimizeSolidDepsPlugin(),
            {
              name: "previewjs:disable-solid-hmr",
              async transform(code, id) {
                if (!id.endsWith(".jsx") && !id.endsWith(".tsx")) {
                  return null;
                }
                // HMR prevents preview props from being refreshed.
                // For now, we disable it entirely.
                return code.replace(/import\.meta/g, "({})");
              },
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

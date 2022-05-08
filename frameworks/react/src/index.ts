import type { Component, FrameworkPluginFactory } from "@previewjs/core";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import path from "path";
import ts from "typescript";
import { extractReactComponents } from "./extract-component";
import { optimizeReactDepsPlugin } from "./optimize-deps-plugin";
import { reactImportsPlugin } from "./react-imports-plugin";
import { REACT_SPECIAL_TYPES } from "./special-types";
import { svgrPlugin } from "./svgr-plugin";

export const reactFrameworkPlugin: FrameworkPluginFactory<{
  svgr?: {
    componentName?: string;
    disable?: boolean;
  };
}> = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["react"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) >= 16;
  },
  async create({ svgr } = {}) {
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-react",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      specialTypes: REACT_SPECIAL_TYPES,
      tsCompilerOptions: {
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "react",
      },
      transformReader: (reader, rootDirPath) =>
        createStackedReader([
          reader,
          createFileSystemReader({
            mapping: {
              from: path.join(previewDirPath, "types"),
              to: path.join(rootDirPath, "node_modules", "@types"),
            },
            watch: false,
          }),
        ]),
      detectComponents: async (typeAnalyzer, absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          components.push(
            ...extractReactComponents(resolver, absoluteFilePath)
          );
        }
        return components;
      },
      viteConfig: (config) => {
        return {
          resolve: {
            alias: {
              "react-native": "react-native-web",
            },
          },
          plugins: [
            optimizeReactDepsPlugin(),
            svgr?.disable
              ? null
              : svgrPlugin({
                  exportedComponentName:
                    svgr?.componentName || "ReactComponent",
                  alias: config.alias,
                }),
            reactImportsPlugin(),
          ],
          define: {
            "process.env.RUNNING_INSIDE_PREVIEWJS": "1",
          },
        };
      },
    };
  },
};

import type { Component, FrameworkPluginFactory } from "@previewjs/core";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";
import ts from "typescript";
import { extractReactComponents } from "./extract-component";
import { reactImportsPlugin } from "./react-js-imports-plugin";
import { REACT_SPECIAL_TYPES } from "./special-types";

const reactFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["react"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) >= 16;
  },
  async create() {
    const previewDirPath = findPreviewDir(path.join(__dirname, ".."));
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
      viteConfig: () => {
        return {
          resolve: {
            alias: {
              "react-native": "react-native-web",
            },
          },
          plugins: [
            reactImportsPlugin(),
            react(),
            {
              name: "previewjs:disable-react-hmr",
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

function findPreviewDir(dirPath: string): string {
  const potentialPath = path.join(dirPath, "preview");
  if (fs.existsSync(potentialPath)) {
    return potentialPath;
  } else {
    const parentPath = path.dirname(dirPath);
    if (!parentPath || parentPath === dirPath) {
      throw new Error(`Unable to find preview directory`);
    }
    return findPreviewDir(parentPath);
  }
}

export default reactFrameworkPlugin;

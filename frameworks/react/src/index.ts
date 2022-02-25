import type {
  DetectedComponent,
  FrameworkPluginFactory,
} from "@previewjs/core";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import path from "path";
import ts from "typescript";
import { analyzeReactComponent } from "./analyze-component";
import { detectArgs } from "./args";
import { reactComponentLoaderPlugin } from "./component-loader-plugin";
import { extractReactComponents, ReactComponent } from "./extract-component";
import { optimizeReactDepsPlugin } from "./optimize-deps-plugin";
import { detectPropTypes } from "./prop-types";
import { reactImportsPlugin } from "./react-imports-plugin";
import { REACT_SPECIAL_TYPES } from "./special-types";
import { svgrPlugin } from "./svgr-plugin";
export type { ReactComponent } from "./extract-component";

export const reactFrameworkPlugin: FrameworkPluginFactory<
  {
    svgr?: {
      componentName?: string;
    };
  },
  DetectedComponent & {
    signature: ts.Signature;
  }
> = {
  isCompatible: async (dependencies) => {
    const react = dependencies["react"];
    if (!react) {
      return false;
    }
    return react.majorVersion >= 16;
  },
  async create({ svgr } = {}) {
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      name: "@previewjs/plugin-react",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
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
      componentDetector: (program, filePaths) => {
        const components: ReactComponent[] = [];
        for (const filePath of filePaths) {
          components.push(...extractReactComponents(program, filePath));
        }
        return components;
      },
      componentAnalyzer:
        ({ typescriptAnalyzer, getTypeAnalyzer }) =>
        (filePath, componentName) => {
          const program = typescriptAnalyzer.analyze([filePath]);
          const typeAnalyzer = getTypeAnalyzer(program, REACT_SPECIAL_TYPES);
          const component = extractReactComponents(program, filePath).find(
            (c) => c.name === componentName
          );
          if (!component) {
            throw new Error(
              `Component ${componentName} was not found in ${filePath}`
            );
          }
          const sourceFile = program.getSourceFile(filePath);
          let args: ts.Expression | null = null;
          let propTypes: ts.Expression | null = null;
          if (sourceFile) {
            args = detectArgs(sourceFile, component.name);
            propTypes = detectPropTypes(sourceFile, component.name);
          }
          return analyzeReactComponent(
            typeAnalyzer,
            component,
            args,
            propTypes
          );
        },
      viteConfig: (config) => {
        return {
          plugins: [
            optimizeReactDepsPlugin(),
            reactComponentLoaderPlugin({
              config,
            }),
            svgrPlugin({
              exportedComponentName: svgr?.componentName || "ReactComponent",
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

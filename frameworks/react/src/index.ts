import type {
  DetectedComponent,
  FrameworkPluginFactory,
} from "@previewjs/core";
import path from "path";
import ts from "typescript";
import { reactComponentLoaderPlugin } from "./component-loader-plugin";
import { extractReactComponents, ReactComponent } from "./extract-component";
import { optimizeReactDepsPlugin } from "./optimize-deps-plugin";
import { reactImportsPlugin } from "./react-imports-plugin";
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
        typeRoots: [path.join(previewDirPath, "types")],
        jsx: ts.JsxEmit.ReactJSX,
        jsxImportSource: "react",
      },
      componentDetector: (program, filePaths) => {
        const components: ReactComponent[] = [];
        for (const filePath of filePaths) {
          components.push(...extractReactComponents(program, filePath));
        }
        return components;
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

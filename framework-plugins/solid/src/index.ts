import type { Component, Story } from "@previewjs/analyzer-api";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { createTypeAnalyzer } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";
import url from "url";
import vitePluginSolid from "vite-plugin-solid";
import { analyze } from "./analyze.js";
import { optimizeSolidDepsPlugin } from "./optimize-deps-plugin.js";
import { SOLID_SPECIAL_TYPES } from "./special-types.js";

const solidFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["solid-js"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) === 1;
  },
  async create({ rootDir, reader, logger }) {
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    const typeAnalyzer = createTypeAnalyzer({
      rootDir,
      reader,
      specialTypes: SOLID_SPECIAL_TYPES,
      tsCompilerOptions: {
        jsx: ts.JsxEmit.Preserve,
        jsxImportSource: "solid-js",
      },
    });
    return {
      pluginApiVersion: 4,
      name: "@previewjs/plugin-solid",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      typeAnalyzer,
      analyze: async (absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        const stories: Story[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          for (const previewable of await analyze(
            logger,
            resolver,
            rootDir,
            absoluteFilePath
          )) {
            if ("extractProps" in previewable) {
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
          plugins: [
            ...configuredPlugins.filter(
              (plugin) =>
                plugin.name !== "solid-start-file-system-router" &&
                plugin.name !== "solid-start-inline-server-modules" &&
                plugin.name !== "solid-start-server"
            ),
            configuredPlugins.find((plugin) => plugin.name.includes("solid"))
              ? null
              : vitePluginSolid(),
            optimizeSolidDepsPlugin(),
            {
              name: "previewjs:disable-solid-hmr",
              async transform(code, id) {
                if (!id.endsWith(".jsx") && !id.endsWith(".tsx")) {
                  return null;
                }
                // HMR prevents preview props from being refreshed.
                // For now, we disable it entirely.
                return code.replace(/import\.meta\.hot/g, "false");
              },
            },
          ],
          define: {
            "process.env.RUNNING_INSIDE_PREVIEWJS": "1",
          },
        };
      },
      dispose: () => {
        typeAnalyzer.dispose();
      },
    };
  },
};

export default solidFrameworkPlugin;

import type { Component, FrameworkPluginFactory } from "@previewjs/core";
import { createTypeAnalyzer } from "@previewjs/type-analyzer";
import path from "path";
import ts from "typescript";
import url from "url";
import vitePluginSolid from "vite-plugin-solid";
import { extractSolidComponents } from "./extract-component.js";
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
      pluginApiVersion: 3,
      name: "@previewjs/plugin-solid",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      typeAnalyzer,
      detectComponents: async (absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          components.push(
            ...extractSolidComponents(
              logger,
              resolver,
              rootDir,
              absoluteFilePath
            )
          );
          // Ensure this potentially long-running function doesn't block the thread.
          await 0;
        }
        return components;
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
    };
  },
};

export default solidFrameworkPlugin;

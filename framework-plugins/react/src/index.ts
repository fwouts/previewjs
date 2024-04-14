import { createAnalyzer } from "@previewjs/analyzer-react";
import type { FrameworkPluginFactory } from "@previewjs/core";
import react from "@vitejs/plugin-react";
import { polyfillNode } from "esbuild-plugin-polyfill-node";
import path from "path";
import url from "url";
import { reactImportsPlugin } from "./react-js-imports-plugin.js";

const reactFrameworkPlugin: FrameworkPluginFactory = {
  info: {
    apiVersion: 5,
    name: "@previewjs/plugin-react",
  },
  isCompatible: async (dependencies) => {
    const version = await dependencies["react"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    const [major, minor] = version.split(".").map((n) => parseInt(n)) as [
      number,
      number
    ];
    if (isNaN(major) || isNaN(minor)) {
      return false;
    }
    return major >= 17 || (major === 16 && minor >= 14);
  },
  async create({ rootDir, reader, logger, dependencies }) {
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const analyzerPlugin = createAnalyzer({
      rootDir,
      reader,
      logger,
    });
    const previewDirPath = path.join(__dirname, "..", "preview");
    return {
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      ...analyzerPlugin,
      viteConfig: (configuredPlugins) => {
        const hasReactPlugin = configuredPlugins.find((plugin) =>
          plugin.name.startsWith("vite:react-")
        );
        return {
          optimizeDeps: {
            esbuildOptions: {
              plugins: dependencies["next"] ? [polyfillNode()] : [],
            },
          },
          resolve: {
            alias: {
              "react-native": "react-native-web",
            },
          },
          plugins: [
            reactImportsPlugin(),
            ...configuredPlugins,
            ...(!hasReactPlugin ? [react()] : []),
            {
              name: "previewjs:update-react-import",
              async transform(code: string, id: string) {
                if (!id.endsWith("__previewjs_internal__/renderer/index.tsx")) {
                  return;
                }
                const reactVersion = parseInt(
                  (await dependencies["react"]?.readInstalledVersion()) || "0"
                );
                return code.replace(
                  /__PREVIEWJS_PLUGIN_REACT_IMPORT_PATH__/g,
                  reactVersion >= 18 ? "./render-18" : "./render-16"
                );
              },
            },
          ],
        };
      },
    };
  },
};

export default reactFrameworkPlugin;

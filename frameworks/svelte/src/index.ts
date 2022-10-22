import type { Component, FrameworkPluginFactory } from "@previewjs/core";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import fs from "fs-extra";
import path from "path";
import { analyzeSvelteComponent } from "./analyze-component";
import { createSvelteTypeScriptReader } from "./svelte-reader";

const svelteFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["svelte"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) === 3;
  },
  async create() {
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-svelte",
      transformReader: (reader) => createSvelteTypeScriptReader(reader),
      defaultWrapperPath: "__previewjs__/Wrapper.svelte",
      previewDirPath,
      detectComponents: async (typeAnalyzer, absoluteFilePaths) => {
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          if (
            absoluteFilePath.endsWith(".svelte") &&
            (await fs.pathExists(absoluteFilePath))
          ) {
            const name = path.basename(
              absoluteFilePath,
              path.extname(absoluteFilePath)
            );
            components.push({
              absoluteFilePath,
              name,
              offsets: [
                [0, (await fs.readFile(absoluteFilePath, "utf-8")).length],
              ],
              info: {
                kind: "component",
                exported: true,
                analyze: async () =>
                  analyzeSvelteComponent(
                    typeAnalyzer,
                    absoluteFilePath + ".ts"
                  ),
              },
            });
          }
          // TODO: Storybook support.
        }
        return components;
      },
      viteConfig: () => ({
        define: {
          __SVELTEKIT_DEV__: "false",
        },
        publicDir: "static",
        resolve: {
          alias: {
            $app: ".svelte-kit/runtime/app",
          },
        },
        plugins: [
          svelte(),
          {
            name: "previewjs:disable-svelte-hmr",
            async transform(code, id) {
              if (!id.endsWith(".svelte")) {
                return null;
              }
              return code.replace(/import\.meta/g, "({})");
            },
          },
        ],
      }),
      incompatibleVitePlugins: ["vite-plugin-svelte-kit"],
    };
  },
};

export default svelteFrameworkPlugin;

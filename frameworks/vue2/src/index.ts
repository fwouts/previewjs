import type { Component, FrameworkPluginFactory } from "@previewjs/core";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import fs from "fs-extra";
import path from "path";
import { analyzeVueComponentFromTemplate } from "./analyze-component";
import { inferComponentNameFromVuePath } from "./infer-component-name";
import { createVueTypeScriptReader } from "./vue-reader";

/** @deprecated */
export const vue2FrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version =
      (await dependencies["vue"]?.readInstalledVersion()) ||
      (await dependencies["nuxt"]?.readInstalledVersion());
    if (!version) {
      return false;
    }
    return parseInt(version) === 2;
  },
  async create() {
    const { loadNuxtConfig } = await import("@nuxt/config");
    const { createVuePlugin } = await import("vite-plugin-vue2");
    const { extractVueComponents } = await import("./extract-component");
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-vue2",
      defaultWrapperPath: "__previewjs__/Wrapper.vue",
      previewDirPath,
      transformReader: (reader, rootDirPath) =>
        createStackedReader([
          createVueTypeScriptReader(reader),
          createFileSystemReader({
            mapping: {
              from: path.join(previewDirPath, "modules"),
              to: path.join(rootDirPath, "node_modules"),
            },
            watch: false,
          }),
        ]),
      detectComponents: async (typeAnalyzer, absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(absoluteFilePaths);
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          if (absoluteFilePath.endsWith(".vue")) {
            components.push({
              absoluteFilePath,
              name: inferComponentNameFromVuePath(absoluteFilePath),
              offsets: [[0, Infinity]],
              info: {
                kind: "component",
                exported: true,
                analyze: async () =>
                  analyzeVueComponentFromTemplate(
                    typeAnalyzer,
                    absoluteFilePath
                  ),
              },
            });
          } else {
            components.push(
              ...extractVueComponents(resolver, absoluteFilePath)
            );
          }
        }
        return components;
      },
      viteConfig: () => {
        let rootDirPath: string;
        return {
          resolve: {
            alias: {
              vue: "vue/dist/vue.esm.js",
            },
          },
          plugins: [
            createVuePlugin({
              jsx: true,
            }),
            {
              name: "previewjs:import-vue-without-extension",
              configResolved(config) {
                rootDirPath = config.root;
              },
              async resolveId(source, importer) {
                const potentialVueFilePath = path.join(
                  importer && source.startsWith(".")
                    ? path.dirname(importer)
                    : rootDirPath,
                  source + ".vue"
                );
                if (await fs.pathExists(potentialVueFilePath)) {
                  return potentialVueFilePath;
                }
                return null;
              },
            },
            {
              name: "previewjs:disable-vue-hmr",
              async transform(code) {
                // HMR causes issues such as https://github.com/underfin/vite-plugin-vue2/issues/149.
                // It also prevents preview props from being refreshed.
                // For now, we disable it entirely.
                const matchHmr = /\/\* hot reload \*\/(.|\n)*\n}/m;
                return code.replace(matchHmr, "");
              },
            },
            {
              name: "previewjs:nuxt-style-resources",
              async config(config) {
                try {
                  const nuxtConfig = await loadNuxtConfig({
                    rootDir: config.root || process.cwd(),
                  });
                  const preprocessorOptions: Record<string, any> = {};
                  for (const [key, resources] of Object.entries(
                    nuxtConfig.styleResources || {}
                  )) {
                    const imports =
                      typeof resources === "string" ? [resources] : resources;
                    if (!Array.isArray(imports)) {
                      throw new Error(
                        `Unsupported styleResources: ${JSON.stringify(imports)}`
                      );
                    }
                    preprocessorOptions[key] = {
                      additionalData: imports
                        .map((p: string) => `@import "${p}";`)
                        .join("\n"),
                    };
                  }
                  return {
                    css: {
                      preprocessorOptions,
                    },
                  };
                } catch (e) {
                  console.warn(e);
                  return {};
                }
              },
            },
            {
              name: "previewjs:optimize-deps",
              config: () => ({
                optimizeDeps: {
                  include: ["vue"],
                },
              }),
            },
          ],
        };
      },
      esbuild: {
        jsxFactory: "h",
      },
    };
  },
};

export default vue2FrameworkPlugin;

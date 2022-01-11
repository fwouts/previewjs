import type {
  DetectedComponent,
  FrameworkPluginFactory,
} from "@previewjs/core";
import fs from "fs-extra";
import path from "path";

export const vue2FrameworkPlugin: FrameworkPluginFactory<{
  vueOptionsModule?: string;
}> = {
  isCompatible: async (dependencies) => {
    return (
      dependencies["vue"]?.majorVersion === 2 ||
      dependencies["nuxt"]?.majorVersion === 2
    );
  },
  async create({ vueOptionsModule } = {}) {
    const { loadNuxtConfig } = await import("@nuxt/config");
    const { createVuePlugin } = await import("vite-plugin-vue2");
    const { vueComponentLoaderPlugin } = await import(
      "./component-loader-plugin"
    );
    const { extractVueComponents } = await import("./extract-component");
    return {
      name: "@previewjs/plugin-vue2",
      defaultWrapperPath: "__previewjs__/Wrapper.vue",
      previewDirPath: path.resolve(__dirname, "..", "preview"),
      componentDetector: (program, filePaths) => {
        const components: DetectedComponent[] = [];
        for (const filePath of filePaths) {
          if (filePath.endsWith(".vue")) {
            const name = path.basename(filePath, path.extname(filePath));
            components.push({
              filePath,
              name,
              exported: true,
              offsets: [[0, Infinity]],
            });
          } else {
            components.push(...extractVueComponents(program, filePath));
          }
        }
        return components;
      },
      viteConfig: (config) => {
        const OPTIONS_MODULE = "@previewjs/plugin-vue2/options";
        let rootDirPath: string;
        return {
          resolve: {
            alias: {
              vue: "vue/dist/vue.esm.js",
            },
          },
          plugins: [
            vueComponentLoaderPlugin({
              config,
            }),
            createVuePlugin({
              jsx: true,
            }),
            {
              name: "previewjs:vue-options",
              async resolveId(source) {
                if (source === OPTIONS_MODULE) {
                  if (vueOptionsModule) {
                    return path.join(rootDirPath, vueOptionsModule);
                  } else {
                    return OPTIONS_MODULE;
                  }
                }
                return null;
              },
              async load(id) {
                if (id === OPTIONS_MODULE) {
                  return `export {}`;
                }
                return null;
              },
            },
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
              async transform(code, id) {
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

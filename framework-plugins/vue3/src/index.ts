import type { Component, Story } from "@previewjs/analyzer-api";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { createTypeAnalyzer } from "@previewjs/type-analyzer";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import path from "path";
import url from "url";
import { crawlFile } from "./crawl-file.js";
import { createVueTypeScriptReader } from "./vue-reader.js";

const vue3FrameworkPlugin: FrameworkPluginFactory = {
  info: {
    apiVersion: 5,
    name: "@previewjs/plugin-vue3",
  },
  isCompatible: async (dependencies) => {
    const version =
      (await dependencies["vue"]?.readInstalledVersion()) ||
      (await dependencies["nuxt"]?.readInstalledVersion()) ||
      (await dependencies["nuxt3"]?.readInstalledVersion());
    if (!version) {
      return false;
    }
    return parseInt(version) === 3;
  },
  async create({ rootDir, reader }) {
    const { default: createVuePlugin } = await import("@vitejs/plugin-vue");
    const { default: vueJsxPlugin } = await import("@vitejs/plugin-vue-jsx");
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    const typeAnalyzer = createTypeAnalyzer({
      rootDir,
      reader: createStackedReader([
        createVueTypeScriptReader(reader),
        createFileSystemReader({
          mapping: {
            from: path.join(previewDirPath, "modules"),
            to: path.join(rootDir, "node_modules"),
          },
          watch: false,
        }),
      ]),
      tsCompilerOptions: {
        types: ["vue/jsx"],
      },
    });
    return {
      defaultWrapperPath: "__previewjs__/Wrapper.vue",
      previewDirPath,
      typeAnalyzer,
      crawlFiles: async (filePaths) => {
        const absoluteFilePaths = filePaths.map((f) =>
          path.isAbsolute(f) ? f : path.join(rootDir, f)
        );
        const resolver = typeAnalyzer.analyze(
          absoluteFilePaths.map((p) => (p.endsWith(".vue") ? p + ".ts" : p))
        );

        const components: Component[] = [];
        const stories: Story[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          for (const previewable of await crawlFile(
            reader,
            resolver,
            rootDir,
            absoluteFilePath
          )) {
            if ("exported" in previewable) {
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
            ...configuredPlugins,
            configuredPlugins.find((plugin) => plugin.name === "vite:vue")
              ? null
              : createVuePlugin(),
            configuredPlugins.find((plugin) => plugin.name.includes("jsx"))
              ? null
              : vueJsxPlugin(),
            {
              name: "previewjs:optimize-deps",
              config: () => ({
                optimizeDeps: {
                  include: ["vue"],
                },
              }),
            },
          ],
          esbuild: {
            banner: `import { h } from 'vue';`,
            jsxFactory: "h",
          },
          resolve: {
            alias: {
              vue: "vue/dist/vue.esm-bundler.js",
            },
          },
        };
      },
      dispose: () => {
        typeAnalyzer.dispose();
      },
    };
  },
};

export default vue3FrameworkPlugin;

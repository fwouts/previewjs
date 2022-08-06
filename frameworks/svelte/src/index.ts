import type { Component, FrameworkPluginFactory } from "@previewjs/core";
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
    // https://github.com/microsoft/TypeScript/issues/43329
    const { sveltekit } = await Function(
      'return import("@sveltejs/kit/vite")'
    )();
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-svelte",
      transformReader: (reader) => createSvelteTypeScriptReader(reader),
      defaultWrapperPath: "__previewjs__/Wrapper.svelte",
      previewDirPath,
      detectComponents: async (typeAnalyzer, absoluteFilePaths) => {
        const components: Component[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          if (absoluteFilePath.endsWith(".svelte")) {
            const name = path.basename(
              absoluteFilePath,
              path.extname(absoluteFilePath)
            );
            components.push({
              absoluteFilePath,
              name,
              isStory: false,
              exported: true,
              offsets: [[0, Infinity]],
              analyze: async () =>
                analyzeSvelteComponent(typeAnalyzer, absoluteFilePath),
            });
          }
          // TODO: Storybook support.
        }
        return components;
      },
      viteConfig: () => ({
        plugins: [sveltekit()],
      }),
    };
  },
};

export default svelteFrameworkPlugin;

import { qwikVite } from "@builder.io/qwik/optimizer";
import type { FrameworkPluginFactory } from "@previewjs/core";
import path from "path";

const svelteFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["qwik"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return true;
  },
  async create() {
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      pluginApiVersion: 3,
      name: "@previewjs/plugin-qwik",
      defaultWrapperPath: "__previewjs__/Wrapper.tsx",
      previewDirPath,
      detectComponents: async (_typeAnalyzer, _absoluteFilePaths) => {
        return [];
      },
      viteConfig: () => ({
        plugins: [qwikVite()],
      }),
    };
  },
};

export default svelteFrameworkPlugin;

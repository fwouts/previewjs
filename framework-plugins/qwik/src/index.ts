import { qwikVite } from "@builder.io/qwik/optimizer";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { EMPTY_OBJECT_TYPE } from "@previewjs/type-analyzer";
import path from "path";

const svelteFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies[
      "@builder.io/qwik"
    ]?.readInstalledVersion();
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
        // TODO: Implement for real.
        return [
          {
            absoluteFilePath: "src/components/header/header.tsx",
            name: "default",
            offsets: [[0, 1000]],
            info: {
              kind: "component",
              exported: true,
              analyze: async () => {
                return {
                  propsType: EMPTY_OBJECT_TYPE,
                  types: {},
                };
              },
            },
          },
        ];
      },
      viteConfig: () => ({
        plugins: [qwikVite()],
      }),
    };
  },
};

export default svelteFrameworkPlugin;

import type { Component, Story } from "@previewjs/component-analyzer-api";
import type { FrameworkPluginFactory } from "@previewjs/core";
import { createTypeAnalyzer } from "@previewjs/type-analyzer";
import type sveltekit from "@sveltejs/kit";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import fs from "fs-extra";
import path from "path";
import url from "url";
import { extractSvelteComponents } from "./extract-component.js";
import { createSvelteTypeScriptReader } from "./svelte-reader.js";

const svelteFrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    const version = await dependencies["svelte"]?.readInstalledVersion();
    if (!version) {
      return false;
    }
    return parseInt(version) >= 3;
  },
  async create({ rootDir, reader }) {
    const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    const svelteConfigPath = path.join(rootDir, "svelte.config.js");
    let alias: Record<string, string> = {};
    let isSvelteKit = false;
    if (await fs.pathExists(svelteConfigPath)) {
      // Source: https://github.com/sveltejs/kit/blob/168547325c0044bc97c9c60aba1b70942dde22fe/packages/kit/src/core/config/index.js#L70
      const config: sveltekit.Config = (
        await import(
          `${url.pathToFileURL(svelteConfigPath).href}?ts=${Date.now()}`
        )
      ).default;
      alias = config.kit?.alias || {};
      isSvelteKit = Boolean(config.kit);
    }
    const typeAnalyzer = createTypeAnalyzer({
      rootDir,
      reader: createSvelteTypeScriptReader(reader),
    });
    return {
      pluginApiVersion: 4,
      name: "@previewjs/plugin-svelte",
      defaultWrapperPath: "__previewjs__/Wrapper.svelte",
      previewDirPath,
      typeAnalyzer,
      detectComponents: async (absoluteFilePaths) => {
        const resolver = typeAnalyzer.analyze(
          absoluteFilePaths.map((p) => (p.endsWith(".svelte") ? `${p}.ts` : p))
        );
        const components: Component[] = [];
        const stories: Story[] = [];
        for (const absoluteFilePath of absoluteFilePaths) {
          for (const componentOrStory of await extractSvelteComponents(
            reader,
            resolver,
            rootDir,
            absoluteFilePath
          )) {
            if (componentOrStory.kind === "component") {
              components.push(componentOrStory);
            } else {
              stories.push(componentOrStory);
            }
          }
        }
        return {
          components,
          stories,
        };
      },
      viteConfig: (configuredPlugins) => ({
        ...(isSvelteKit
          ? {
              define: {
                __SVELTEKIT_DEV__: "false",
                __SVELTEKIT_APP_VERSION_POLL_INTERVAL__: "0",
              },
              resolve: {
                alias: {
                  $app: "node_modules/@sveltejs/kit/src/runtime/app",
                  ...alias,
                },
              },
              publicDir: "static",
            }
          : {}),
        plugins: [
          ...configuredPlugins.filter(
            (plugin) =>
              plugin.name !== "vite-plugin-svelte-kit" &&
              plugin.name !== "vite-plugin-sveltekit-build" &&
              plugin.name !== "vite-plugin-sveltekit-middleware" &&
              plugin.name !== "vite-plugin-sveltekit-setup" &&
              plugin.name !== "vite-plugin-sveltekit-compile"
          ),
          configuredPlugins.find((plugin) => plugin.name.includes("svelte"))
            ? null
            : svelte(),
          isSvelteKit
            ? {
                name: "previewjs:fake-sveltekit-client",
                transform(code, id) {
                  if (
                    id.includes(
                      "@sveltejs/kit/src/runtime/client/singletons.js"
                    )
                  ) {
                    // Prevent errors with missing client methods such as disable_scroll_handling.
                    return code
                      .replace(`export let client`, `export let client = {}`)
                      .replace(
                        `url: notifiable_store({})`,
                        `url: notifiable_store(document.location)`
                      )
                      .replace(
                        `page: notifiable_store({})`,
                        `page: notifiable_store({ url: document.location })`
                      );
                  }
                  return null;
                },
              }
            : null,
          {
            name: "previewjs:disable-svelte-hmr",
            async transform(code, id) {
              if (!id.endsWith(".svelte")) {
                return null;
              }
              return code.replace(/import\.meta\.hot/g, "false");
            },
          },
        ],
      }),
      dispose: () => {
        typeAnalyzer.dispose();
      },
    };
  },
};

export default svelteFrameworkPlugin;

import type {
  DetectedComponent,
  FrameworkPluginFactory,
} from "@previewjs/core";
import {
  createFileSystemReader,
  createStackedReader,
} from "@previewjs/core/vfs";
import { UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import type { Node } from "acorn";
import path from "path";
import { analyzeVueComponentFromTemplate } from "./analyze-component";
import { createVueTypeScriptReader } from "./vue-reader";

export const vue3FrameworkPlugin: FrameworkPluginFactory = {
  isCompatible: async (dependencies) => {
    return dependencies["vue"]?.majorVersion === 3 || !!dependencies["nuxt3"];
  },
  async create() {
    const { default: createVuePlugin } = await import("@vitejs/plugin-vue");
    const { default: vueJsxPlugin } = await import("@vitejs/plugin-vue-jsx");
    const { vueComponentLoaderPlugin } = await import(
      "./component-loader-plugin"
    );
    const { extractVueComponents } = await import("./extract-component");
    const { Parser } = await import("acorn");
    const previewDirPath = path.resolve(__dirname, "..", "preview");
    return {
      name: "@previewjs/plugin-vue3",
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
      componentAnalyzer:
        ({ typescriptAnalyzer, getTypeAnalyzer }) =>
        (filePath, componentName) => {
          if (filePath.endsWith(".vue")) {
            return analyzeVueComponentFromTemplate(
              typescriptAnalyzer,
              getTypeAnalyzer,
              filePath
            );
          } else {
            // TODO: Handle JSX and Storybook stories.
            return {
              name: componentName,
              propsType: UNKNOWN_TYPE,
              providedArgs: new Set(),
              types: {},
            };
          }
        },
      viteConfig: (config) => {
        return {
          plugins: [
            vueComponentLoaderPlugin({
              config,
            }),
            createVuePlugin(),
            vueJsxPlugin(),
            {
              name: "previewjs:disable-vue-hmr",
              async transform(code, id) {
                if (!id.endsWith(".vue")) {
                  return null;
                }
                // HMR code prevents component loader from receiving
                // updated preview props, so we disable it.
                // If you find a better or more reliable way, please
                // feel free to send a PR :)
                const matchHmr = /import\.meta\.hot\.accept\((.|\n)*\}\);?/m;
                return code.replace(matchHmr, "");
              },
            },
            {
              name: "previewjs:process-define-preview",
              async transform(code, id) {
                if (!code.includes("const _sfc_main = ")) {
                  return;
                }
                let parsed: Node;
                try {
                  parsed = Parser.parse(code, {
                    ecmaVersion: "latest",
                    sourceType: "module",
                  });
                } catch (e) {
                  return null;
                }

                // Note: acorn doesn't provide detailed typings.
                for (const statement of (parsed as any).body || []) {
                  if (statement.type === "VariableDeclaration") {
                    for (const declaration of statement.declarations) {
                      if (
                        declaration.type === "VariableDeclarator" &&
                        declaration.id.type === "Identifier" &&
                        declaration.id.name === "_sfc_main" &&
                        declaration.init.type === "CallExpression" &&
                        declaration.init.callee.type === "Identifier" &&
                        declaration.init.callee.name === "_defineComponent" &&
                        declaration.init.arguments.length > 0 &&
                        declaration.init.arguments[0].type ===
                          "ObjectExpression"
                      ) {
                        const properties =
                          declaration.init.arguments[0].properties;
                        const setupProperty = properties.find(
                          (p: any) =>
                            p.key.name === "setup" &&
                            p.value.type === "FunctionExpression"
                        );
                        if (!setupProperty) {
                          continue;
                        }
                        const setupBody = setupProperty.value.body.body;
                        const definePreviewsCall = setupBody.find(
                          (s: any) =>
                            s.type === "ExpressionStatement" &&
                            s.expression.type === "CallExpression" &&
                            s.expression.callee.type === "Identifier" &&
                            s.expression.callee.name === "definePreviews"
                        );
                        if (
                          !definePreviewsCall ||
                          definePreviewsCall.expression.arguments.length === 0
                        ) {
                          continue;
                        }
                        const props =
                          definePreviewsCall.expression.arguments[0];
                        return (
                          code +
                          `
                          _sfc_main.previews = ${code.slice(
                            props.start,
                            props.end
                          )};
                          `
                        );
                      }
                    }
                  }
                }
                return null;
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
    };
  },
};

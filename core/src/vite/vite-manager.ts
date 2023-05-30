import { decodeComponentId } from "@previewjs/api";
import type { PreviewConfig } from "@previewjs/config";
import type { Reader } from "@previewjs/vfs";
import type { Alias } from "@rollup/plugin-alias";
import express from "express";
import fs from "fs-extra";
import type { Server } from "http";
import path from "path";
import type { Logger } from "pino";
import fakeExportedTypesPlugin from "rollup-plugin-friendly-type-imports";
import { loadTsconfig } from "tsconfig-paths/lib/tsconfig-loader.js";
import * as vite from "vite";
import { searchForWorkspaceRoot } from "vite";
import viteTsconfigPaths from "vite-tsconfig-paths";
import { findFiles } from "../find-files";
import type { FrameworkPlugin } from "../plugins/framework";
import { cssModulesWithoutSuffixPlugin } from "./plugins/css-modules-without-suffix-plugin";
import { exportToplevelPlugin } from "./plugins/export-toplevel-plugin";
import { localEval } from "./plugins/local-eval";
import { publicAssetImportPluginPlugin } from "./plugins/public-asset-import-plugin";
import { virtualPlugin } from "./plugins/virtual-plugin";

export class ViteManager {
  readonly middleware: express.RequestHandler;
  private viteStartupPromise: Promise<void> | undefined;
  private viteServer?: vite.ViteDevServer;

  constructor(
    private readonly options: {
      logger: Logger;
      reader: Reader;
      base: string;
      componentId: string;
      rootDirPath: string;
      shadowHtmlFilePath: string;
      detectedGlobalCssFilePaths: string[];
      cacheDir: string;
      config: PreviewConfig;
      frameworkPlugin: FrameworkPlugin;
    }
  ) {
    const router = express.Router();
    router.use(async (req, res, next) => {
      const waitSeconds = 60;
      const waitUntil = Date.now() + waitSeconds * 1000;
      while (!this.viteServer) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        if (Date.now() > waitUntil) {
          throw new Error(
            `Vite server is not running after ${waitSeconds} seconds.`
          );
        }
      }
      this.viteServer.middlewares(req, res, next);
    });
    this.middleware = router;
  }

  async loadIndexHtml(url: string) {
    const template = await fs.readFile(
      this.options.shadowHtmlFilePath,
      "utf-8"
    );
    await this.viteStartupPromise;
    if (!this.viteServer) {
      throw new Error(`Vite server is not running.`);
    }
    const { filePath } = decodeComponentId(this.options.componentId);
    const componentPath = filePath.replace(/\\/g, "/");
    const wrapper = this.options.config.wrapper;
    const wrapperPath =
      wrapper &&
      (await fs.pathExists(path.join(this.options.rootDirPath, wrapper.path)))
        ? wrapper.path.replace(/\\/g, "/")
        : null;
    return await this.viteServer.transformIndexHtml(
      url,
      template.replace(/%([^%]+)%/gi, (matched) => {
        switch (matched) {
          case "%INIT_PREVIEW_BLOCK%":
            return `
    let latestComponentModule;
    let latestWrapperModule;
    let refresh;
    
    const componentModulePromise = import(/* @vite-ignore */ "/${componentPath}");
    import.meta.hot.accept(["/${componentPath}"], ([componentModule]) => {
      if (componentModule && refresh) {
        latestComponentModule = componentModule;
        refresh(latestComponentModule, latestWrapperModule);
      }
    });

    ${
      wrapperPath
        ? `
    const wrapperModulePromise = import(/* @vite-ignore */ "/${wrapperPath}");
    import.meta.hot.accept(["/${wrapperPath}"], ([wrapperModule]) => {
      if (wrapperModule && refresh) {
        latestWrapperModule = wrapperModule;
        refresh(latestComponentModule, latestWrapperModule);
      }
    });
    `
        : `
    const wrapperModulePromise = Promise.resolve(null);
    ${this.options.detectedGlobalCssFilePaths
      .map(
        (cssFilePath) =>
          `import(/* @vite-ignore */ "/${cssFilePath.replace(/\\/g, "/")}");`
      )
      .join("\n")}
    `
    }
    Promise.all([componentModulePromise, wrapperModulePromise])
        .then(([componentModule, wrapperModule]) => {
          latestComponentModule = componentModule;
          latestWrapperModule = wrapperModule;
          refresh = initPreview({
            componentModule,
            componentId: ${JSON.stringify(this.options.componentId)},
            wrapperModule,
            wrapperName: ${JSON.stringify(wrapper?.componentName || null)},
          });
        });
  `;
          default:
            throw new Error(`Unknown template key: ${matched}`);
        }
      })
    );
  }

  async start(server: Server, port: number) {
    // Find valid tsconfig.json files.
    //
    // Useful when the project may contain some invalid files.
    this.options.logger.debug(`Finding js/tsconfig.json files`);
    const typeScriptConfigAbsoluteFilePaths = await findFiles(
      this.options.rootDirPath,
      "{js,ts}config.json"
    );
    this.options.logger.debug(
      `Found ${typeScriptConfigAbsoluteFilePaths.length} config files`
    );
    const typeScriptConfigFilePaths = typeScriptConfigAbsoluteFilePaths.map(
      (p) => path.relative(this.options.rootDirPath, p)
    );
    const validTypeScriptFilePaths: string[] = [];
    for (const configFilePath of typeScriptConfigFilePaths) {
      try {
        loadTsconfig(configFilePath);
        validTypeScriptFilePaths.push(configFilePath);
      } catch (e) {
        this.options.logger.warn(
          `Encountered an invalid config file, ignoring: ${configFilePath}`
        );
      }
    }
    this.options.logger.debug(
      `Found ${typeScriptConfigAbsoluteFilePaths.length} files`
    );
    const tsInferredAlias: Alias[] = [];
    // If there is a top-level tsconfig.json, use it to infer aliases.
    // While this is also done by vite-tsconfig-paths, it doesn't apply to CSS Modules and so on.
    const configFile = typeScriptConfigFilePaths.includes("tsconfig.json")
      ? "tsconfig.json"
      : "jsconfig.json";
    const config = loadTsconfig(configFile);
    this.options.logger.debug(
      `Loaded ${configFile}: ${JSON.stringify(config || null, null, 2)}`
    );
    if (config?.compilerOptions?.baseUrl && config?.compilerOptions?.paths) {
      const { baseUrl, paths } = config.compilerOptions;
      for (const [match, mapping] of Object.entries(paths)) {
        const firstMapping = mapping[0];
        if (!firstMapping) {
          continue;
        }
        const matchNoWildcard = match.endsWith("/*")
          ? match.slice(0, match.length - 2)
          : match;
        const firstMappingNoWildcard = firstMapping.endsWith("/*")
          ? firstMapping.slice(0, firstMapping.length - 2)
          : firstMapping;
        tsInferredAlias.push({
          find: matchNoWildcard,
          replacement: path.join(
            this.options.rootDirPath,
            baseUrl,
            firstMappingNoWildcard
          ),
        });
      }
    }
    const existingViteConfig = await vite.loadConfigFromFile(
      {
        command: "serve",
        mode: "development",
      },
      undefined,
      this.options.rootDirPath
    );
    const defaultLogger = vite.createLogger(
      viteLogLevelFromPinoLogger(this.options.logger)
    );
    const frameworkPluginViteConfig = this.options.frameworkPlugin.viteConfig(
      await flattenPlugins([
        ...(existingViteConfig?.config.plugins || []),
        ...(this.options.config.vite?.plugins || []),
      ])
    );
    const publicDir =
      this.options.config.vite?.publicDir ||
      existingViteConfig?.config.publicDir ||
      frameworkPluginViteConfig.publicDir ||
      this.options.config.publicDir;
    const vitePlugins: Array<vite.PluginOption | vite.PluginOption[]> = [
      viteTsconfigPaths({
        root: this.options.rootDirPath,
        projects: validTypeScriptFilePaths,
      }),
      virtualPlugin({
        logger: this.options.logger,
        reader: this.options.reader,
        rootDirPath: this.options.rootDirPath,
        allowedAbsolutePaths: this.options.config.vite?.server?.fs?.allow || [
          searchForWorkspaceRoot(this.options.rootDirPath),
        ],
        moduleGraph: () => this.viteServer?.moduleGraph || null,
        esbuildOptions: frameworkPluginViteConfig.esbuild || {},
      }),
      localEval(),
      exportToplevelPlugin(),
      fakeExportedTypesPlugin({
        readFile: (absoluteFilePath) =>
          this.options.reader.read(absoluteFilePath).then((entry) => {
            if (entry?.kind !== "file") {
              return null;
            }
            return entry.read();
          }),
      }),
      cssModulesWithoutSuffixPlugin(),
      publicAssetImportPluginPlugin({
        rootDirPath: this.options.rootDirPath,
        publicDir,
      }),
      frameworkPluginViteConfig.plugins,
    ];

    // We need to patch handleHotUpdate() in every plugin because, by
    // default, HmrContext has a read() method that reads directly from
    // the file system. We want it to read from our reader, which could
    // be using an in-memory version instead.
    const plugins = await Promise.all(
      vitePlugins.flat().map(async (pluginOrPromise) => {
        const plugin = await pluginOrPromise;
        if (!plugin || Array.isArray(plugin) || !plugin.handleHotUpdate) {
          return plugin;
        }
        // Note: this gets rid of the "pre" / "post" handler. It's probably fine.
        // If not, it's easily fixed. PR welcome!
        const handleHotUpdate =
          typeof plugin.handleHotUpdate === "function"
            ? plugin.handleHotUpdate
            : plugin.handleHotUpdate.handler;
        return {
          ...plugin,
          handleHotUpdate: async (ctx: vite.HmrContext) => {
            return handleHotUpdate({
              ...ctx,
              read: async () => {
                const entry = await this.options.reader.read(ctx.file);
                if (entry?.kind !== "file") {
                  // Fall back to default behaviour.
                  return ctx.read();
                }
                return entry.read();
              },
            });
          },
        };
      })
    );
    this.options.logger.debug(`Creating Vite server`);
    const viteServerPromise = vite.createServer({
      ...frameworkPluginViteConfig,
      ...existingViteConfig?.config,
      ...this.options.config.vite,
      configFile: false,
      root: this.options.rootDirPath,
      base: this.options.base,
      server: {
        middlewareMode: true,
        hmr: {
          overlay: false,
          server: {
            ...server,
            on: (event, listener) => {
              if (event === "upgrade") {
                // Vite doesn't check req.url, so it ends up trying to upgrade the same
                // socket multiple times if multiple Vite managers are running.
                // See https://github.com/vitejs/vite/blob/5c3fa057f10b1adea4e28f58f69bf6b636eac4aa/packages/vite/src/node/server/ws.ts#L105
                server.on("upgrade", (req, socket, head) => {
                  if (req.url === this.options.base) {
                    // TODO: Why doesn't this.options.logger.error() work?
                    listener(req, socket, head);
                  }
                });
              } else {
                server.on(event, listener);
              }
            },
          } as Server,
          clientPort: port,
          ...(typeof this.options.config.vite?.server?.hmr === "object"
            ? this.options.config.vite?.server?.hmr
            : {}),
        },
        fs: {
          strict: false,
          ...(this.options.config.vite?.server?.fs || {}),
        },
        ...this.options.config.vite?.server,
      },
      customLogger: {
        info: defaultLogger.info,
        warn: defaultLogger.warn,
        error: (msg, options) => {
          if (!msg.startsWith("\x1B[31mInternal server error")) {
            // Note: we only send errors through WebSocket when they're not already sent by Vite automatically.
            this.viteServer?.ws.send({
              type: "error",
              err: {
                message: msg,
                stack: "",
              },
            });
          }
          defaultLogger.error(msg, options);
        },
        warnOnce: defaultLogger.warnOnce,
        clearScreen: () => {
          // Do nothing.
        },
        hasWarned: defaultLogger.hasWarned,
        hasErrorLogged: defaultLogger.hasErrorLogged,
      },
      clearScreen: false,
      cacheDir:
        this.options.config.vite?.cacheDir ||
        existingViteConfig?.config.cacheDir ||
        this.options.cacheDir,
      publicDir,
      plugins,
      define: {
        ...existingViteConfig?.config.define,
        __filename: undefined,
        __dirname: undefined,
        ...frameworkPluginViteConfig.define,
        ...existingViteConfig?.config.define,
        ...this.options.config.vite?.define,
      },
      resolve: {
        ...existingViteConfig?.config.resolve,
        ...this.options.config.vite?.resolve,
        alias: [
          // First defined rules are applied first, therefore highest priority should come first.
          ...viteAliasToRollupAliasEntries(
            this.options.config.vite?.resolve?.alias
          ),
          ...viteAliasToRollupAliasEntries(this.options.config.alias),
          ...viteAliasToRollupAliasEntries(
            existingViteConfig?.config.resolve?.alias
          ),
          ...tsInferredAlias,
          {
            find: "~",
            replacement: "",
          },
          {
            find: "@",
            replacement: "",
          },
          ...viteAliasToRollupAliasEntries(
            frameworkPluginViteConfig.resolve?.alias
          ),
        ],
      },
    });
    this.viteStartupPromise = new Promise<void>((resolve) => {
      viteServerPromise.finally(() => {
        resolve();
        delete this.viteStartupPromise;
      });
    });
    this.viteServer = await viteServerPromise;
    this.options.logger.debug(`Done starting Vite server`);
    this.viteServer.watcher.addListener("change", (path) => {
      this.viteServer?.ws.send({
        type: "custom",
        event: "previewjs-file-changed",
        data: {
          path,
        },
      });
    });
  }

  async stop() {
    if (this.viteServer) {
      await this.viteServer.close();
      delete this.viteServer;
    }
  }

  getConfig() {
    return this.options.config;
  }

  triggerReload(absoluteFilePath: string) {
    if (!this.viteServer) {
      return;
    }
    for (const onChange of this.viteServer.watcher.listeners("change")) {
      onChange(absoluteFilePath);
    }
  }

  triggerFullReload() {
    this.viteServer?.moduleGraph.invalidateAll();
    this.viteServer?.ws.send({
      type: "full-reload",
    });
  }
}

function viteAliasToRollupAliasEntries(alias?: vite.AliasOptions) {
  if (!alias) {
    return [];
  }
  if (Array.isArray(alias)) {
    return alias;
  } else {
    return Object.entries(alias).map(([find, replacement]) => ({
      find,
      replacement,
    }));
  }
}

async function flattenPlugins(
  pluginOptions: vite.PluginOption[]
): Promise<vite.Plugin[]> {
  const plugins: vite.Plugin[] = [];
  for (const pluginOption of await Promise.all(pluginOptions)) {
    if (!pluginOption) {
      continue;
    }
    if (Array.isArray(pluginOption)) {
      plugins.push(...(await flattenPlugins(pluginOption)));
    } else {
      plugins.push(pluginOption);
    }
  }
  return plugins;
}

function viteLogLevelFromPinoLogger(logger: Logger): vite.LogLevel {
  switch (logger.level) {
    case "fatal":
      return "silent";
    case "error":
      return "error";
    case "warn":
      return "warn";
    case "info":
      return "info";
    case "debug":
      return "info";
    case "trace":
      return "info";
    case "silent":
      return "silent";
    default:
      logger.warn(`Unknown log level: ${logger.level}`);
      return "info";
  }
}

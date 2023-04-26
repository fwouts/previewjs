import type { PreviewConfig } from "@previewjs/config";
import type { Reader } from "@previewjs/vfs";
import type { Alias } from "@rollup/plugin-alias";
import express from "express";
import fs from "fs-extra";
import { escape } from "html-escaper";
import type { Server } from "http";
import path from "path";
import fakeExportedTypesPlugin from "rollup-plugin-friendly-type-imports";
import { loadTsconfig } from "tsconfig-paths/lib/tsconfig-loader.js";
import * as vite from "vite";
import { searchForWorkspaceRoot } from "vite";
import viteTsconfigPaths from "vite-tsconfig-paths";
import { findFiles } from "../find-files";
import type { FrameworkPlugin } from "../plugins/framework";
import { componentLoaderPlugin } from "./plugins/component-loader-plugin";
import { cssModulesWithoutSuffixPlugin } from "./plugins/css-modules-without-suffix-plugin";
import { exportToplevelPlugin } from "./plugins/export-toplevel-plugin";
import { localEval } from "./plugins/local-eval";
import { publicAssetImportPluginPlugin } from "./plugins/public-asset-import-plugin";
import { virtualPlugin } from "./plugins/virtual-plugin";

export class ViteManager {
  readonly middleware: express.RequestHandler;
  private viteStartupPromise: Promise<void> | undefined;
  private viteServer?: vite.ViteDevServer;
  private lastPingTimestamp = 0;

  constructor(
    private readonly options: {
      reader: Reader;
      rootDirPath: string;
      shadowHtmlFilePath: string;
      detectedGlobalCssFilePaths: string[];
      cacheDir: string;
      config: PreviewConfig;
      logLevel: vite.UserConfig["logLevel"];
      frameworkPlugin: FrameworkPlugin;
    }
  ) {
    const router = express.Router();
    router.get("/preview/", async (req, res) => {
      try {
        const template = await fs.readFile(
          this.options.shadowHtmlFilePath,
          "utf-8"
        );
        await this.viteStartupPromise;
        if (!this.viteServer) {
          res.status(404).end(`Uh-Oh! Vite server is not running.`);
          return;
        }
        res
          .status(200)
          .set({ "Content-Type": "text/html" })
          .end(
            await this.viteServer.transformIndexHtml(req.originalUrl, template)
          );
      } catch (e: any) {
        res
          .status(500)
          .set({ "Content-Type": "text/html" })
          .end(
            `<html>
              <head>
                <style>
                  body {
                    background: #FCA5A5
                  }
                  pre {
                    font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
                    monospace;
                    font-size: 12px;
                    line-height: 1.5em;
                    color: #7F1D1D;
                  }
                </style>
              </head>
              <body>
                <pre>${escape(`${e}` || "An unknown error has occurred")}</pre>
              </body>
            </html>`
          );
      }
    });
    router.use("/ping", async (req, res) => {
      this.lastPingTimestamp = Date.now();
      res.json(
        JSON.stringify({
          pong: "match!",
        })
      );
    });
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

  async start(server: Server, port: number) {
    // Find valid tsconfig.json files.
    //
    // Useful when the project may contain some invalid files.
    const typeScriptConfigAbsoluteFilePaths = await findFiles(
      this.options.rootDirPath,
      "{js,ts}config.json"
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
        console.warn(
          `Encountered an invalid config file, ignoring: ${configFilePath}`
        );
      }
    }
    const tsInferredAlias: Alias[] = [];
    // If there is a top-level tsconfig.json, use it to infer aliases.
    // While this is also done by vite-tsconfig-paths, it doesn't apply to CSS Modules and so on.
    const config = loadTsconfig(
      typeScriptConfigFilePaths.includes("tsconfig.json")
        ? "tsconfig.json"
        : "jsconfig.json"
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
    const defaultLogger = vite.createLogger(this.options.logLevel);
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
      componentLoaderPlugin(this.options),
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
    const viteServerPromise = vite.createServer({
      ...frameworkPluginViteConfig,
      ...existingViteConfig?.config,
      ...this.options.config.vite,
      configFile: false,
      root: this.options.rootDirPath,
      base: "/preview/",
      server: {
        middlewareMode: true,
        hmr: {
          overlay: false,
          server,
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

  getLastPingTimestamp() {
    return this.lastPingTimestamp;
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

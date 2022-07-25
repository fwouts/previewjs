import type { PreviewConfig } from "@previewjs/config";
import type { Reader } from "@previewjs/vfs";
import express from "express";
import fs from "fs-extra";
import type { Server } from "http";
import path from "path";
import { recrawl } from "recrawl";
import fakeExportedTypesPlugin from "rollup-plugin-friendly-type-imports";
import { loadTsconfig } from "tsconfig-paths/lib/tsconfig-loader.js";
import * as vite from "vite";
import viteTsconfigPaths from "vite-tsconfig-paths";
import type { FrameworkPlugin } from "../plugins/framework";
import { componentLoaderPlugin } from "./plugins/component-loader-plugin";
import { cssModulesWithoutSuffixPlugin } from "./plugins/css-modules-without-suffix-plugin";
import { exportToplevelPlugin } from "./plugins/export-toplevel-plugin";
import { virtualPlugin } from "./plugins/virtual-plugin";

export class ViteManager {
  readonly middleware: express.RequestHandler;
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
      const template = await fs.readFile(
        this.options.shadowHtmlFilePath,
        "utf-8"
      );
      if (!this.viteServer) {
        res.status(404).end(`Vite is not running.`);
        return;
      }
      res
        .status(200)
        .set({ "Content-Type": "text/html" })
        .end(
          await this.viteServer.transformIndexHtml(req.originalUrl, template)
        );
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
    const typeScriptConfigFilePaths = await recrawl({
      only: ["tsconfig.json"],
      skip: ["node_modules", ".git"],
    })(this.options.rootDirPath);
    const validTypeScriptFilePaths: string[] = [];
    for (const configFilePath of typeScriptConfigFilePaths) {
      try {
        loadTsconfig(configFilePath);
        validTypeScriptFilePaths.push(configFilePath);
      } catch (e) {
        console.warn(
          `Encountered an invalid tsconfig.json file, ignoring: ${configFilePath}`
        );
      }
    }
    const tsInferredAlias: Record<string, string> = {};
    if (typeScriptConfigFilePaths.includes("tsconfig.json")) {
      // If there is a top-level tsconfig.json, use it to infer aliases.
      // While this is also done by vite-tsconfig-paths, it doesn't apply to CSS Modules and so on.
      const config = loadTsconfig("tsconfig.json");
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
          tsInferredAlias[matchNoWildcard] = path.join(
            this.options.rootDirPath,
            baseUrl,
            firstMappingNoWildcard
          );
        }
      }
    }
    const alias = {
      ...tsInferredAlias,
      ...this.options.config.alias,
      ...this.options.config.vite?.resolve?.alias,
    };
    const defaultLogger = vite.createLogger(this.options.logLevel);
    const frameworkPluginViteConfig = this.options.frameworkPlugin.viteConfig({
      ...this.options.config,
      alias,
    });
    const vitePlugins: Array<vite.PluginOption | vite.PluginOption[]> = [
      viteTsconfigPaths({
        root: this.options.rootDirPath,
        projects: validTypeScriptFilePaths,
      }),
      virtualPlugin({
        reader: this.options.reader,
        rootDirPath: this.options.rootDirPath,
        moduleGraph: () => this.viteServer?.moduleGraph || null,
        esbuildOptions: frameworkPluginViteConfig.esbuild || {},
      }),
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
      componentLoaderPlugin(this.options),
      ...(frameworkPluginViteConfig.plugins || []),
      ...(this.options.config.vite?.plugins || []),
    ];

    // We need to patch handleHotUpdate() in every plugin because, by
    // default, HmrContext has a read() method that reads directly from
    // the file system. We want it to read from our reader, which could
    // be using an in-memory version instead.
    const plugins = vitePlugins.flat().map((plugin) => {
      if (!plugin || Array.isArray(plugin) || !plugin.handleHotUpdate) {
        return plugin;
      }
      const handleHotUpdate = plugin.handleHotUpdate.bind(plugin);
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
    });

    this.viteServer = await vite.createServer({
      ...frameworkPluginViteConfig,
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
        ...this.options.config.vite?.server,
      },
      customLogger: {
        info: defaultLogger.info,
        warn: defaultLogger.warn,
        error: defaultLogger.error,
        warnOnce: defaultLogger.warnOnce,
        clearScreen: () => {
          // Do nothing.
        },
        hasWarned: defaultLogger.hasWarned,
        hasErrorLogged: defaultLogger.hasErrorLogged,
      },
      clearScreen: false,
      cacheDir: this.options.config.vite?.cacheDir || this.options.cacheDir,
      publicDir:
        this.options.config.vite?.publicDir || this.options.config.publicDir,
      plugins,
      define: {
        __filename: undefined,
        __dirname: undefined,
        ...frameworkPluginViteConfig.define,
        ...this.options.config.vite?.define,
      },
      resolve: {
        ...this.options.config.vite?.resolve,
        alias: {
          "~": "",
          "@": "",
          ...alias,
          ...frameworkPluginViteConfig.resolve?.alias,
        },
      },
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

  async renderIndexHtml(originalUrl: string) {
    if (!this.viteServer) {
      throw new Error(`Vite server is not running.`);
    }
    const template = await fs.readFile(
      this.options.shadowHtmlFilePath,
      "utf-8"
    );
    return await this.viteServer.transformIndexHtml(originalUrl, template);
  }
}

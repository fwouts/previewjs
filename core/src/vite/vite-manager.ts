import viteTsconfigPaths from "@fwouts/vite-tsconfig-paths";
import { decodePreviewableId } from "@previewjs/analyzer-api";
import {
  PREVIEW_CONFIG_NAMES,
  readConfig,
  type PreviewConfig,
} from "@previewjs/config";
import type {
  Reader,
  ReaderListener,
  ReaderListenerInfo,
} from "@previewjs/vfs";
import type { Alias } from "@rollup/plugin-alias";
import { exclusivePromiseRunner } from "exclusive-promises";
import express from "express";
import fs from "fs-extra";
import type { Server } from "http";
import path from "path";
import type { Logger } from "pino";
import fakeExportedTypesPlugin from "rollup-plugin-friendly-type-imports";
import { loadTsconfig } from "tsconfig-paths/lib/tsconfig-loader.js";
import * as vite from "vite";
import { searchForWorkspaceRoot } from "vite";
import { z } from "zod";
import { FILES_REQUIRING_REDETECTION } from "../crawl-files.js";
import { findFiles } from "../find-files.js";
import { generateHtmlError } from "../html-error.js";
import type { FrameworkPlugin } from "../plugins/framework.js";
import { cssModulesWithoutSuffixPlugin } from "./plugins/css-modules-without-suffix-plugin.js";
import { invalidateStoriesModulesOnUpdate } from "./plugins/invalidate-stories-modules-on-update.js";
import { localEval } from "./plugins/local-eval.js";
import {
  previewScriptPlugin,
  type PreviewScriptOptions,
} from "./plugins/preview-script.js";
import { publicAssetImportPluginPlugin } from "./plugins/public-asset-import-plugin.js";
import { virtualPlugin } from "./plugins/virtual-plugin.js";
import { toVitePath } from "./vite-paths.js";

const POSTCSS_CONFIG_FILE = [
  ".postcssrc",
  ".postcssrc.json",
  ".postcssrc.yml",
  ".postcssrc.js",
  ".postcssrc.mjs",
  ".postcssrc.cjs",
  ".postcssrc.ts",
  "postcss.config.js",
  "postcss.config.mjs",
  "postcss.config.cjs",
  "postcss.config.ts",
];

const GLOBAL_CSS_FILE_NAMES_WITHOUT_EXT = [
  "index",
  "global",
  "globals",
  "style",
  "styles",
  "app",
];
const GLOBAL_CSS_EXTS = ["css", "sass", "scss", "less", "styl", "stylus"];

const GLOBAL_CSS_FILE = GLOBAL_CSS_FILE_NAMES_WITHOUT_EXT.flatMap((fileName) =>
  GLOBAL_CSS_EXTS.map((ext) => `${fileName}.${ext}`)
);

const FILES_REQUIRING_VITE_RESTART = new Set([
  ...PREVIEW_CONFIG_NAMES,
  ...FILES_REQUIRING_REDETECTION,
  ...POSTCSS_CONFIG_FILE,
  ...GLOBAL_CSS_FILE,
  "vite.config.js",
  "vite.config.ts",
  // TODO: Make plugins contribute files requiring restart to make core agnostic of Svelte config files.
  "svelte.config.js",
]);

type ViteState =
  | {
      kind: "starting";
      // Note: This promise is guaranteed not to ever throw.
      promise: Promise<ViteEndState>;
    }
  | {
      kind: "running";
      viteServer: vite.ViteDevServer;
      config: PreviewConfig & { detectedGlobalCssFilePaths: string[] };
    }
  | {
      kind: "error";
      error: string;
    };

type ViteEndState = Exclude<ViteState, { kind: "starting" }>;

async function endState(state: ViteState | null) {
  if (state?.kind === "starting") {
    return state.promise;
  } else {
    return state;
  }
}

export class ViteManager {
  readonly middleware: express.RequestHandler;
  #state: ViteState | null = null;
  #exclusively: <T>(f: () => Promise<T>) => Promise<T>;
  #readerListener: ReaderListener = {
    onChange: (absoluteFilePath, info) => {
      this.onFileChanged(path.resolve(absoluteFilePath), info).catch((e) =>
        this.options.logger.error(e)
      );
    },
  };

  get state() {
    return this.#state;
  }

  constructor(
    private readonly options: {
      logger: Logger;
      reader: Reader;
      rootDir: string;
      shadowHtmlFilePath: string;
      cacheDir: string;
      frameworkPlugin: FrameworkPlugin;
      server: Server;
      port: number;
      clientPort?: number;
    }
  ) {
    const router = express.Router();
    router.use(async (req, res, next) => {
      const state = await endState(this.#state);
      if (!state || state.kind === "error") {
        return next();
      }
      try {
        state.viteServer.middlewares(req, res, next);
      } catch (e) {
        this.options.logger.error(`Vite middleware error: ${e}`);
        res.status(500).end(`Vite middleware error: ${e}`);
      }
    });
    this.middleware = router;
    this.#exclusively = exclusivePromiseRunner();
  }

  async loadIndexHtml(url: string, id: string): Promise<string> {
    // Note: this must run exclusively from stop() or viteServer.transformIndexHtml()
    // could fail with "The server is being restarted or closed. Request is outdated".
    return this.#exclusively(async () => {
      try {
        const state = await endState(this.#state);
        if (!state) {
          return generateHtmlError(`Vite server is not running`);
        }
        if (state.kind === "error") {
          return generateHtmlError(state.error);
        }
        const template = await fs.readFile(
          this.options.shadowHtmlFilePath,
          "utf-8"
        );
        const { config, viteServer } = state;
        const { filePath, name: previewableName } = decodePreviewableId(id);
        const previewablePath = filePath.replace(/\\/g, "/");
        const wrapper = config.wrapper;
        const wrapperPath =
          wrapper &&
          (await fs.pathExists(path.join(this.options.rootDir, wrapper.path)))
            ? wrapper.path.replace(/\\/g, "/")
            : null;
        return await viteServer.transformIndexHtml(
          url,
          template.replace(
            "<!-- %OPTIONAL_HEAD_CONTENT% -->",
            `<script type="module" src="/__previewjs_internal__/preview.js?p=${Buffer.from(
              JSON.stringify({
                previewablePath,
                previewableName,
                wrapperPath,
                wrapperName: wrapper?.componentName || null,
                detectedGlobalCssFilePaths: config.detectedGlobalCssFilePaths,
              } satisfies PreviewScriptOptions),
              "utf8"
            ).toString("base64url")}"></script>`
          )
        );
      } catch (e) {
        return generateHtmlError(`${e}`);
      }
    });
  }

  // Note: this is guaranteed not to throw.
  async start() {
    let setEndState!: (running: ViteEndState) => void;
    this.#state = {
      kind: "starting",
      promise: new Promise<ViteEndState>((resolve) => {
        setEndState = (state: ViteEndState) => {
          this.#state = state;
          resolve(state);
        };
      }),
    };
    this.options.reader.listeners.add(this.#readerListener);
    try {
      // PostCSS requires the current directory to change because it relies
      // on the `import-cwd` package to resolve plugins.
      process.chdir(this.options.rootDir);
      const configFromProject = await readConfig(
        this.options.rootDir,
        viteLogLevelFromPinoLogger(this.options.logger)
      );
      const globalCssAbsoluteFilePaths = await findFiles(
        this.options.rootDir,
        `**/@(${GLOBAL_CSS_FILE_NAMES_WITHOUT_EXT.join(
          "|"
        )}).@(${GLOBAL_CSS_EXTS.join("|")})`,
        {
          maxDepth: 3,
        }
      );
      const config = {
        ...configFromProject,
        wrapper: configFromProject.wrapper || {
          path: this.options.frameworkPlugin.defaultWrapperPath,
        },
        detectedGlobalCssFilePaths: globalCssAbsoluteFilePaths.map(
          (absoluteFilePath) =>
            path.relative(this.options.rootDir, absoluteFilePath)
        ),
      };
      const tsInferredAlias: Alias[] = [];
      // If there is a top-level tsconfig.json, use it to infer aliases.
      // While this is also done by vite-tsconfig-paths, it doesn't apply to CSS Modules and so on.
      let tsConfig: z.infer<typeof validTsConfig> | null = null;
      for (const potentialTsConfigFileName of [
        "tsconfig.json",
        "jsconfig.json",
      ]) {
        const potentialTsConfigFilePath = path.join(
          this.options.rootDir,
          potentialTsConfigFileName
        );
        try {
          if (await fs.pathExists(potentialTsConfigFilePath)) {
            // It's possible to get an invalid tsconfig despite loadTsconfig() succeeding
            // because it doesn't fully check the schema. For example, if the "paths"
            // record contains strings instead of arrays of strings, we'll get a crash
            // later on.
            const unsafeTsConfig =
              loadTsconfig(potentialTsConfigFilePath) || null;
            if (unsafeTsConfig) {
              tsConfig = validTsConfig.parse(unsafeTsConfig);
              break;
            }
          }
        } catch (e) {
          // Silently fail.
          this.options.logger.warn(
            `Unable to load tsconfig from ${potentialTsConfigFilePath}: ${e}`
          );
        }
      }
      this.options.logger.debug(
        `Loaded ts/jsconfig: ${JSON.stringify(tsConfig || null, null, 2)}`
      );
      const baseUrl = tsConfig?.compilerOptions?.baseUrl || "";
      const tsConfigPaths = tsConfig?.compilerOptions?.paths || {};
      let baseAlias = baseUrl.startsWith("./") ? baseUrl.substring(1) : baseUrl;
      if (baseAlias && !baseAlias.endsWith("/")) {
        baseAlias += "/";
      }
      for (const [match, mapping] of Object.entries(tsConfigPaths)) {
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
            this.options.rootDir,
            baseUrl,
            firstMappingNoWildcard
          ),
        });
      }
      const existingViteConfig = await vite.loadConfigFromFile(
        {
          command: "serve",
          mode: "development",
        },
        undefined,
        this.options.rootDir
      );
      const defaultLogger = vite.createLogger(
        viteLogLevelFromPinoLogger(this.options.logger)
      );
      const frameworkPluginViteConfig = this.options.frameworkPlugin.viteConfig(
        await flattenPlugins([
          ...(existingViteConfig?.config.plugins || []),
          ...(config.vite?.plugins || []),
        ])
      );
      const publicDir =
        config.vite?.publicDir ||
        existingViteConfig?.config.publicDir ||
        frameworkPluginViteConfig.publicDir ||
        config.publicDir ||
        "public";
      const plugins = replaceHandleHotUpdate(
        this.options.reader,
        await flattenPlugins([
          viteTsconfigPaths({
            root: this.options.rootDir,
          }),
          previewScriptPlugin(),
          virtualPlugin({
            logger: this.options.logger,
            reader: this.options.reader,
            rootDir: this.options.rootDir,
            allowedAbsolutePaths: config.vite?.server?.fs?.allow ||
              existingViteConfig?.config.server?.fs?.allow || [
                searchForWorkspaceRoot(this.options.rootDir),
              ],
            moduleGraph: () => {
              if (this.#state?.kind === "running") {
                return this.#state.viteServer.moduleGraph;
              }
              return null;
            },
            esbuildOptions: frameworkPluginViteConfig.esbuild || {},
          }),
          localEval(),
          invalidateStoriesModulesOnUpdate(),
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
            rootDir: this.options.rootDir,
            publicDir,
          }),
          frameworkPluginViteConfig.plugins,
        ])
      );
      this.options.logger.debug(`Creating Vite server`);
      const viteServerPromise = vite.createServer({
        ...frameworkPluginViteConfig,
        ...existingViteConfig?.config,
        ...config.vite,
        configFile: false,
        root: this.options.rootDir,
        server: {
          middlewareMode: true,
          hmr: {
            overlay: false,
            server: this.options.server,
            clientPort: this.options.clientPort || this.options.port,
            ...(typeof config.vite?.server?.hmr === "object"
              ? config.vite?.server?.hmr
              : {}),
          },
          fs: {
            strict: false,
            ...(config.vite?.server?.fs || {}),
          },
          ...config.vite?.server,
        },
        customLogger: {
          info: defaultLogger.info,
          warn: defaultLogger.warn,
          error: (msg, options) => {
            if (!msg.startsWith("\x1B[31mInternal server error")) {
              // Note: we only send errors through WebSocket when they're not already sent by Vite automatically.
              if (this.#state?.kind === "running") {
                this.#state.viteServer.ws.send({
                  type: "error",
                  err: {
                    message: msg,
                    stack: "",
                  },
                });
              }
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
          config.vite?.cacheDir ||
          existingViteConfig?.config.cacheDir ||
          this.options.cacheDir,
        publicDir,
        plugins,
        define: {
          __filename: undefined,
          __dirname: undefined,
          process: undefined,
          ...frameworkPluginViteConfig.define,
          ...existingViteConfig?.config.define,
          ...config.vite?.define,
        },
        resolve: {
          ...existingViteConfig?.config.resolve,
          ...config.vite?.resolve,
          alias: [
            // First defined rules are applied first, therefore highest priority should come first.
            ...viteAliasToRollupAliasEntries(config.vite?.resolve?.alias),
            ...viteAliasToRollupAliasEntries(config.alias),
            ...viteAliasToRollupAliasEntries(
              existingViteConfig?.config.resolve?.alias
            ),
            ...tsInferredAlias,
            {
              find: /^~(.*)/,
              replacement: baseAlias + "$1",
            },
            {
              find: "@",
              replacement: baseAlias,
            },
            ...viteAliasToRollupAliasEntries(
              frameworkPluginViteConfig.resolve?.alias
            ),
          ],
        },
      });
      const viteServer = await viteServerPromise;
      setEndState({
        kind: "running",
        config,
        viteServer,
      });
      this.options.logger.debug(`Done starting Vite server`);
    } catch (e: any) {
      this.options.logger.error(`Vite startup error: ${e}`);
      setEndState({
        kind: "error",
        error: e.stack || e.message,
      });
    }
    return this.#state.promise;
  }

  async stop({ restart }: { restart: boolean } = { restart: false }) {
    await this.#exclusively(async () => {
      this.options.reader.listeners.remove(this.#readerListener);
      const state = await endState(this.#state);
      if (state?.kind === "running") {
        await state.viteServer.close();
      }
      if (restart) {
        return this.start();
      } else {
        return (this.#state = null);
      }
    });
  }

  private async onFileChanged(
    absoluteFilePath: string,
    info: ReaderListenerInfo
  ) {
    const state = await endState(this.state);
    if (!state) {
      return;
    }
    if (!info.virtual) {
      // Note: this doesn't strictly fit well in ViteManager. It may be better refactored out.
      this.options.frameworkPlugin.typeAnalyzer.invalidateCachedTypesForFile(
        path.relative(this.options.rootDir, absoluteFilePath)
      );
      if (FILES_REQUIRING_VITE_RESTART.has(path.basename(absoluteFilePath))) {
        // Packages were updated. Restart.
        this.options.logger.info(
          "New dependencies were detected. Restarting..."
        );
        await this.stop({ restart: true });
        return;
      }
    }
    if (state.kind !== "running") {
      return;
    }
    const { viteServer, config } = state;
    if (info.virtual) {
      const modules = await viteServer.moduleGraph.getModulesByFile(
        toVitePath(absoluteFilePath)
      );
      for (const module of modules || []) {
        if (!module.id) {
          continue;
        }
        try {
          const loaded = await viteServer.pluginContainer.load(module.id);
          if (!loaded) {
            continue;
          }
          const source = typeof loaded === "object" ? loaded.code : loaded;
          await viteServer.pluginContainer.transform(source, module.id);
        } catch {
          // We know it will fail.
          return;
        }
      }
      for (const onChange of viteServer.watcher.listeners("change")) {
        onChange(absoluteFilePath);
      }
    } else if (
      config.wrapper &&
      absoluteFilePath ===
        path.resolve(this.options.rootDir, config.wrapper.path)
    ) {
      viteServer.moduleGraph.invalidateAll();
      viteServer.ws.send({
        type: "full-reload",
      });
    }
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

function replaceHandleHotUpdate(reader: Reader, plugins: vite.Plugin[]) {
  // We need to patch handleHotUpdate() in every plugin because, by
  // default, HmrContext has a read() method that reads directly from
  // the file system. We want it to read from our reader, which could
  // be using an in-memory version instead.
  return plugins.map(async (plugin) => {
    if (!plugin.handleHotUpdate) {
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
        await handleHotUpdate({
          ...ctx,
          read: async () => {
            const entry = await reader.read(ctx.file);
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
}

const validTsConfig = z.object({
  compilerOptions: z
    .object({
      baseUrl: z.string().optional(),
      paths: z.record(z.array(z.string())).optional(),
    })
    .optional(),
});

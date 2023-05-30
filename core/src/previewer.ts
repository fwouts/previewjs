import type { PreviewConfig } from "@previewjs/config";
import { PREVIEW_CONFIG_NAME, readConfig } from "@previewjs/config";
import type { Reader, ReaderListenerInfo } from "@previewjs/vfs";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import assertNever from "assert-never";
import axios from "axios";
import { exclusivePromiseRunner } from "exclusive-promises";
import express from "express";
import { escape } from "html-escaper";
import path from "path";
import type { Logger } from "pino";
import { getCacheDir } from "./caching";
import { FILES_REQUIRING_REDETECTION } from "./detect-components";
import { findFiles } from "./find-files";
import type { FrameworkPlugin } from "./plugins/framework";
import { Server } from "./server";
import { ViteManager } from "./vite/vite-manager";

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

const FILES_REQUIRING_RESTART = new Set([
  PREVIEW_CONFIG_NAME,
  ...FILES_REQUIRING_REDETECTION,
  ...POSTCSS_CONFIG_FILE,
  ...GLOBAL_CSS_FILE,
  "vite.config.js",
  "vite.config.ts",
  // TODO: Make plugins contribute files requiring restart to make core agnostic of Svelte config files.
  "svelte.config.js",
]);

const SHUTDOWN_CHECK_INTERVAL = 3000;
const SHUTDOWN_AFTER_INACTIVITY = 10000;

export class Previewer {
  private readonly transformingReader: Reader;
  private appServer: Server | null = null;
  private viteManagers: Record<string, ViteManager> = {};
  private status: PreviewerStatus = { kind: "stopped" };
  private shutdownCheckInterval: NodeJS.Timeout | null = null;
  private disposeObserver: (() => Promise<void>) | null = null;
  private config: PreviewConfig | null = null;
  private lastPingTimestamp = 0;
  private locking = exclusivePromiseRunner();

  constructor(
    private readonly options: {
      reader: Reader;
      previewDirPath: string;
      rootDirPath: string;
      logger: Logger;
      frameworkPlugin: FrameworkPlugin;
      middlewares: express.RequestHandler[];
      onFileChanged?(absoluteFilePath: string): void;
    }
  ) {
    this.transformingReader = createStackedReader([
      options.reader,
      createFileSystemReader({
        mapping: {
          from: options.frameworkPlugin.previewDirPath,
          to: path.join(
            options.rootDirPath,
            "__previewjs_internal__",
            "renderer"
          ),
        },
        watch: false,
      }),
      createFileSystemReader({
        mapping: {
          from: options.previewDirPath,
          to: options.rootDirPath,
        },
        watch: false,
      }),
    ]);
  }

  async start(
    allocatePort: () => Promise<number>,
    options: { restarting?: boolean } = {}
  ) {
    let port: number;
    const statusBeforeStart = this.status;
    switch (statusBeforeStart.kind) {
      case "starting":
        port = statusBeforeStart.port;
        try {
          await statusBeforeStart.promise;
        } catch (e) {
          this.options.logger.error(e);
          this.status = {
            kind: "stopped",
          };
          await this.startFromStopped(port);
        }
        break;
      case "started":
        if (this.shutdownCheckInterval) {
          clearInterval(this.shutdownCheckInterval);
          this.shutdownCheckInterval = null;
        }
        port = statusBeforeStart.port;
        break;
      case "stopping":
        port = statusBeforeStart.port;
        try {
          await statusBeforeStart.promise;
        } catch (e) {
          this.options.logger.error(e);
          this.status = {
            kind: "stopped",
          };
        }
        await this.start(async () => port, options);
        break;
      case "stopped":
        port = await allocatePort();
        await this.startFromStopped(port, options);
        break;
      default:
        throw assertNever(statusBeforeStart);
    }
    return port;
  }

  private async startFromStopped(
    port: number,
    { restarting }: { restarting?: boolean } = {}
  ) {
    this.status = {
      kind: "starting",
      port,
      promise: (async () => {
        // PostCSS requires the current directory to change because it relies
        // on the `import-cwd` package to resolve plugins.
        process.chdir(this.options.rootDirPath);
        const configFromProject = await readConfig(this.options.rootDirPath);
        const config = (this.config = {
          ...configFromProject,
          wrapper: configFromProject.wrapper || {
            path: this.options.frameworkPlugin.defaultWrapperPath,
          },
        });
        const globalCssAbsoluteFilePaths = await findFiles(
          this.options.rootDirPath,
          `**/@(${GLOBAL_CSS_FILE_NAMES_WITHOUT_EXT.join(
            "|"
          )}).@(${GLOBAL_CSS_EXTS.join("|")})`
        );
        const router = express.Router();
        router.get(/^\/preview\/.*:[^/]+\/$/, async (req, res) => {
          if (req.header("Accept") === "text/x-vite-ping") {
            // This is triggered as part of HMR. It may come after we've
            // switched to rendering a different component, so we want to
            // make sure this doesn't accidentally restart the Vite manager for it.
            res.writeHead(204).end();
            return;
          }
          try {
            const server = this.appServer?.server;
            if (!server) {
              throw new Error(`No server running`);
            }
            const componentId = req.path.substring(9, req.path.length - 1);
            // Note: we only ever have a single active Vite manager.
            // We must prevent race conditions here when we quickly switch back to a
            // component whose Vite manager hasn't stopped yet.
            let viteManager!: ViteManager;
            await this.locking(async () => {
              const existingViteManager = this.viteManagers[componentId];
              if (existingViteManager) {
                viteManager = existingViteManager;
              } else {
                await Promise.all(
                  Object.values(this.viteManagers).map((v) => v.stop())
                );
                this.viteManagers = {};
                this.options.logger.debug(`Initializing Vite manager`);
                viteManager = new ViteManager({
                  componentId,
                  base: req.path,
                  rootDirPath: this.options.rootDirPath,
                  shadowHtmlFilePath: path.join(
                    this.options.previewDirPath,
                    "index.html"
                  ),
                  detectedGlobalCssFilePaths: globalCssAbsoluteFilePaths.map(
                    (absoluteFilePath) =>
                      path.relative(this.options.rootDirPath, absoluteFilePath)
                  ),
                  reader: this.transformingReader,
                  cacheDir: path.join(
                    getCacheDir(this.options.rootDirPath),
                    "vite"
                  ),
                  config,
                  logger: this.options.logger,
                  frameworkPlugin: this.options.frameworkPlugin,
                });
                this.viteManagers[componentId] = viteManager;
                this.options.logger.debug(`Starting Vite manager`);
                await viteManager.start(server, port);
              }
            });
            res
              .status(200)
              .set({ "Content-Type": "text/html" })
              .end(await viteManager.loadIndexHtml(req.originalUrl));
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
        this.appServer = new Server({
          logger: this.options.logger,
          middlewares: [
            ...(this.options.middlewares || []),
            router,
            (req, res, next) => {
              const componentIdMatch = req.path.match(
                /^(\/@id\/__x00__)?\/preview\/(.*:[^/]+)\/.*$/
              );
              if (componentIdMatch) {
                const componentId = componentIdMatch[2]!;
                const viteManager = this.viteManagers[componentId];
                if (viteManager) {
                  viteManager.middleware(req, res, next);
                  return;
                }
              }
              res.status(404).end(`No match for path: ${req.path}`);
            },
          ],
        });
        if (!restarting) {
          // When we restart, we must not stop the file observer otherwise a crash while restarting
          // (e.g. due to an incomplete preview.config.js) would mean that we stop listening altogether,
          // and we will never know to restart.
          if (this.transformingReader.observe) {
            this.disposeObserver = await this.transformingReader.observe(
              this.options.rootDirPath
            );
          }
          this.transformingReader.listeners.add(this.onFileChangeListener);
        }
        this.options.logger.debug(`Starting server`);
        await this.appServer.start(port);
        this.options.logger.debug(`Previewer ready`);
        this.status = {
          kind: "started",
          port,
        };
      })(),
    };
    await this.status.promise;
    // Note: It's unclear why, but in some situations (e.g. Playwright tests) the server
    // doesn't accept connections right away.
    for (let i = 0; ; i++) {
      try {
        await axios.get(`http://localhost:${port}`);
        break;
      } catch (e) {
        if (i === 10) {
          throw e;
        } else {
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }
    }
  }

  async stop(
    options: {
      onceUnused?: boolean;
      restarting?: boolean;
    } = {}
  ) {
    if (this.status.kind === "starting") {
      try {
        await this.status.promise;
      } catch {
        this.status = {
          kind: "stopped",
        };
      }
    }
    if (this.status.kind !== "started") {
      return;
    }
    if (options.onceUnused) {
      if (!(await this.shutdownCheck())) {
        this.shutdownCheckInterval = setInterval(() => {
          this.shutdownCheck().catch(this.options.logger.error);
        }, SHUTDOWN_CHECK_INTERVAL);
      }
    } else {
      await this.stopNow(options);
    }
  }

  private async shutdownCheck() {
    if (this.lastPingTimestamp + SHUTDOWN_AFTER_INACTIVITY > Date.now()) {
      return false;
    }
    if (this.shutdownCheckInterval) {
      clearInterval(this.shutdownCheckInterval);
      this.shutdownCheckInterval = null;
    }
    await this.stopNow();
    return true;
  }

  private async stopNow({
    restarting,
  }: {
    restarting?: boolean;
  } = {}) {
    if (this.status.kind === "starting") {
      await this.status.promise;
    }
    if (this.status.kind !== "started") {
      return;
    }
    this.status = {
      kind: "stopping",
      port: this.status.port,
      promise: (async () => {
        if (!restarting) {
          this.transformingReader.listeners.remove(this.onFileChangeListener);
          if (this.disposeObserver) {
            await this.disposeObserver();
            this.disposeObserver = null;
          }
        }
        await Promise.all(
          Object.values(this.viteManagers).map((v) => v.stop())
        );
        this.viteManagers = {};
        if (this.appServer) {
          await this.appServer.stop();
          this.appServer = null;
        }
        this.status = {
          kind: "stopped",
        };
      })(),
    };
    await this.status.promise;
  }

  private readonly onFileChangeListener = {
    onChange: (absoluteFilePath: string, info: ReaderListenerInfo) => {
      absoluteFilePath = path.resolve(absoluteFilePath);
      if (
        !info.virtual &&
        this.config?.wrapper &&
        absoluteFilePath ===
          path.resolve(this.options.rootDirPath, this.config.wrapper.path)
      ) {
        for (const viteManager of Object.values(this.viteManagers)) {
          viteManager.triggerFullReload();
        }
      }
      if (
        !info.virtual &&
        FILES_REQUIRING_RESTART.has(path.basename(absoluteFilePath))
      ) {
        if (this.status.kind === "starting" || this.status.kind === "started") {
          const port = this.status.port;
          // Packages were updated. Restart.
          this.options.logger.info(
            "New dependencies were detected. Restarting..."
          );
          this.stop({
            restarting: true,
          })
            .then(async () => {
              await this.start(async () => port, { restarting: true });
            })
            .catch(this.options.logger.error);
        }
        return;
      }
      if (info.virtual) {
        for (const viteManager of Object.values(this.viteManagers)) {
          viteManager.triggerReload(absoluteFilePath);
          viteManager.triggerReload(absoluteFilePath + ".ts");
        }
      } else if (this.options.onFileChanged) {
        this.options.onFileChanged(absoluteFilePath);
      }
    },
  };
}

type PreviewerStatus =
  | {
      kind: "starting";
      port: number;
      promise: Promise<void>;
    }
  | {
      kind: "started";
      port: number;
    }
  | {
      kind: "stopping";
      port: number;
      promise: Promise<void>;
    }
  | {
      kind: "stopped";
    };

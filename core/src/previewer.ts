import type { PreviewConfig } from "@previewjs/config";
import { PREVIEW_CONFIG_NAME, readConfig } from "@previewjs/config";
import type { Reader, ReaderListenerInfo } from "@previewjs/vfs";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import assertNever from "assert-never";
import axios from "axios";
import type express from "express";
import path from "path";
import type * as vite from "vite";
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
  private viteManager: ViteManager | null = null;
  private status: PreviewerStatus = { kind: "stopped" };
  private shutdownCheckInterval: NodeJS.Timeout | null = null;
  private disposeObserver: (() => Promise<void>) | null = null;
  private config: PreviewConfig | null = null;

  constructor(
    private readonly options: {
      reader: Reader;
      previewDirPath: string;
      rootDirPath: string;
      logLevel: vite.UserConfig["logLevel"];
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
          console.error(e);
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
          console.error(e);
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
        const config = await readConfig(this.options.rootDirPath);
        this.config = {
          ...config,
          wrapper: config.wrapper || {
            path: this.options.frameworkPlugin.defaultWrapperPath,
          },
        };
        const globalCssAbsoluteFilePaths = await findFiles(
          this.options.rootDirPath,
          `**/@(${GLOBAL_CSS_FILE_NAMES_WITHOUT_EXT.join(
            "|"
          )}).@(${GLOBAL_CSS_EXTS.join("|")})`
        );
        this.appServer = new Server({
          middlewares: [
            ...(this.options.middlewares || []),
            (req, res, next) => {
              this.viteManager?.middleware(req, res, next);
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
        this.viteManager = new ViteManager({
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
          cacheDir: path.join(getCacheDir(this.options.rootDirPath), "vite"),
          config: this.config,
          logLevel: this.options.logLevel,
          frameworkPlugin: this.options.frameworkPlugin,
        });
        const server = await this.appServer.start(port);
        await this.viteManager.start(server, port);
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
          this.shutdownCheck().catch(console.error);
        }, SHUTDOWN_CHECK_INTERVAL);
      }
    } else {
      await this.stopNow(options);
    }
  }

  private async shutdownCheck() {
    const lastPingTimestamp = this.viteManager?.getLastPingTimestamp() || 0;
    if (lastPingTimestamp + SHUTDOWN_AFTER_INACTIVITY > Date.now()) {
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
        if (this.viteManager) {
          await this.viteManager.stop();
          this.viteManager = null;
        }
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
        this.viteManager?.triggerFullReload();
      }
      if (
        !info.virtual &&
        FILES_REQUIRING_RESTART.has(path.basename(absoluteFilePath))
      ) {
        if (this.status.kind === "starting" || this.status.kind === "started") {
          const port = this.status.port;
          // Packages were updated. Restart.
          console.log("New dependencies were detected. Restarting...");
          this.stop({
            restarting: true,
          })
            .then(async () => {
              await this.start(async () => port, { restarting: true });
            })
            .catch(console.error);
        }
        return;
      }
      if (info.virtual) {
        this.viteManager?.triggerReload(absoluteFilePath);
        this.viteManager?.triggerReload(absoluteFilePath + ".ts");
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

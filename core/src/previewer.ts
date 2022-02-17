import { PREVIEW_CONFIG_NAME, readConfig } from "@previewjs/config";
import assertNever from "assert-never";
import express from "express";
import { pathExists } from "fs-extra";
import path from "path";
import * as vite from "vite";
import { FrameworkPlugin } from "./plugins/framework";
import { Server } from "./server";
import {
  createFileSystemReader,
  createStackedReader,
  Reader,
  ReaderListenerInfo,
} from "./vfs";
import { ViteManager } from "./vite/vite-manager";

const POSTCSS_CONFIG_FILE = ["postcss.config.js", ".postcssrc.js"];

const FILES_REQUIRING_RESTART = new Set([
  PREVIEW_CONFIG_NAME,
  "jsconfig.json",
  "tsconfig.json",
  "package.json",
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  ...POSTCSS_CONFIG_FILE,
]);

const SHUTDOWN_CHECK_INTERVAL = 3000;
const SHUTDOWN_AFTER_INACTIVITY = 10000;

export class Previewer {
  private readonly transformingReader: Reader;
  private appServer: Server | null = null;
  private viteManager: ViteManager | null = null;
  private status: PreviewerStatus = { kind: "stopped" };
  private shutdownCheckInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly options: {
      reader: Reader;
      previewDirPath: string;
      rootDirPath: string;
      cacheDirPath: string;
      logLevel: vite.UserConfig["logLevel"];
      frameworkPlugin: FrameworkPlugin;
      middlewares: express.RequestHandler[];
      onFileChanged?(filePath: string): void;
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

  async start(allocatePort: () => Promise<number>) {
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
        await this.start(async () => port);
        break;
      case "stopped":
        port = await allocatePort();
        await this.startFromStopped(port);
        break;
      default:
        throw assertNever(statusBeforeStart);
    }
    return port;
  }

  private async startFromStopped(port: number) {
    this.status = {
      kind: "starting",
      port,
      promise: (async () => {
        // PostCSS requires the current directory to change because it relies
        // on the `import-cwd` package to resolve plugins.
        process.chdir(this.options.rootDirPath);
        const config = await this.refreshConfig();
        this.appServer = new Server({
          middlewares: [
            ...(this.options.middlewares || []),
            (req, res, next) => {
              this.viteManager?.middleware(req, res, next);
            },
          ],
        });
        if (this.transformingReader.observe) {
          await this.transformingReader.observe(this.options.rootDirPath);
        }
        this.transformingReader.listeners.add(this.onFileChangeListener);
        this.viteManager = new ViteManager({
          rootDirPath: this.options.rootDirPath,
          shadowHtmlFilePath: path.join(
            this.options.previewDirPath,
            "index.html"
          ),
          reader: this.transformingReader,
          cacheDir: path.join(this.options.cacheDirPath, "vite"),
          config,
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
  }

  async stop(
    options: {
      onceUnused?: boolean;
    } = {}
  ) {
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
      await this.stopNow();
    }
  }

  private async refreshConfig() {
    const config = await readConfig(this.options.rootDirPath);
    if (!config.wrapper) {
      const defaultWrapperPath =
        this.options.frameworkPlugin.defaultWrapperPath;
      if (
        await pathExists(
          path.join(this.options.rootDirPath, defaultWrapperPath)
        )
      ) {
        config.wrapper = {
          path: defaultWrapperPath,
        };
      }
    }
    return config;
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

  private async stopNow() {
    if (this.status.kind === "starting") {
      await this.status.promise;
    }
    if (this.status.kind !== "started") {
      return;
    }
    this.transformingReader.listeners.remove(this.onFileChangeListener);
    this.status = {
      kind: "stopping",
      port: this.status.port,
      promise: (async () => {
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
    onChange: async (filePath: string, info: ReaderListenerInfo) => {
      filePath = path.resolve(filePath);
      const config = this.viteManager?.getConfig();
      let wrapperAddedOrRemoved = false;
      if (
        config &&
        config.wrapper?.path !== (await this.refreshConfig()).wrapper?.path
      ) {
        wrapperAddedOrRemoved = true;
      }
      if (
        wrapperAddedOrRemoved ||
        (!info.virtual && FILES_REQUIRING_RESTART.has(path.basename(filePath)))
      ) {
        if (this.status.kind === "starting" || this.status.kind === "started") {
          const port = this.status.port;
          // Packages were updated. Restart.
          console.log("New dependencies were detected. Restarting...");
          this.stop()
            .then(async () => {
              await this.start(async () => port);
            })
            .catch(console.error);
        }
        return;
      }
      if (info.virtual) {
        this.viteManager?.triggerReload(filePath);
      } else if (this.options.onFileChanged) {
        this.options.onFileChanged(filePath);
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

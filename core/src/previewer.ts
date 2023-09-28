import type { Reader } from "@previewjs/vfs";
import { createFileSystemReader, createStackedReader } from "@previewjs/vfs";
import assertNever from "assert-never";
import axios from "axios";
import express from "express";
import path from "path";
import type { Logger } from "pino";
import { getCacheDir } from "./caching";
import type { FrameworkPlugin } from "./plugins/framework";
import { Server } from "./server";
import { ViteManager } from "./vite/vite-manager";

export class Previewer {
  private readonly transformingReader: Reader;
  private appServer: Server | null = null;
  private viteManager: ViteManager | null = null;
  private status: PreviewerStatus = { kind: "stopped" };
  private disposeObserver: (() => Promise<void>) | null = null;

  constructor(
    private readonly options: {
      reader: Reader;
      previewDirPath: string;
      rootDir: string;
      logger: Logger;
      frameworkPlugin: FrameworkPlugin;
      middlewares: express.RequestHandler[];
      port: number;
    }
  ) {
    this.transformingReader = createStackedReader([
      options.reader,
      createFileSystemReader({
        mapping: {
          from: options.frameworkPlugin.previewDirPath,
          to: path.join(options.rootDir, "__previewjs_internal__", "renderer"),
        },
        watch: false,
      }),
      createFileSystemReader({
        mapping: {
          from: options.previewDirPath,
          to: options.rootDir,
        },
        watch: false,
      }),
    ]);
  }

  async start(options: { restarting?: boolean } = {}) {
    const statusBeforeStart = this.status;
    switch (statusBeforeStart.kind) {
      case "starting":
        try {
          await statusBeforeStart.promise;
        } catch (e) {
          this.options.logger.error(e);
          this.status = {
            kind: "stopped",
          };
          await this.startFromStopped();
        }
        break;
      case "started":
        break;
      case "stopping":
        try {
          await statusBeforeStart.promise;
        } catch (e) {
          this.options.logger.error(e);
          this.status = {
            kind: "stopped",
          };
        }
        await this.start(options);
        break;
      case "stopped":
        await this.startFromStopped();
        break;
      default:
        throw assertNever(statusBeforeStart);
    }
  }

  private async startFromStopped() {
    this.status = {
      kind: "starting",
      promise: (async () => {
        const router = express.Router();
        router.get(/^\/.*:[^/]+\/$/, async (req, res, next) => {
          if (req.url.includes("?html-proxy")) {
            next();
            return;
          }
          const previewableId = req.path.substring(1, req.path.length - 1);
          if (req.header("Accept") === "text/x-vite-ping") {
            // This is triggered as part of HMR. Exit early.
            res.writeHead(204).end();
            return;
          }
          if (!this.viteManager) {
            res.status(404).end(`Uh-Oh! Vite server is not running.`);
            return;
          }
          res
            .status(200)
            .set({ "Content-Type": "text/html" })
            .end(
              await this.viteManager.loadIndexHtml(
                req.originalUrl,
                previewableId
              )
            );
        });
        router.use("/ping", async (req, res) => {
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
              this.viteManager?.middleware(req, res, next);
            },
          ],
        });
        if (this.transformingReader.observe) {
          this.disposeObserver = await this.transformingReader.observe(
            this.options.rootDir
          );
        }
        this.options.logger.debug(`Starting server`);
        const server = await this.appServer.start(this.options.port);
        this.options.logger.debug(`Starting Vite manager`);
        this.viteManager = new ViteManager({
          rootDir: this.options.rootDir,
          shadowHtmlFilePath: path.join(
            this.options.previewDirPath,
            "index.html"
          ),
          reader: this.transformingReader,
          cacheDir: path.join(getCacheDir(this.options.rootDir), "vite"),
          logger: this.options.logger,
          frameworkPlugin: this.options.frameworkPlugin,
          server,
          port: this.options.port,
        });
        this.viteManager.start();
        this.options.logger.debug(`Previewer ready`);
        this.status = {
          kind: "started",
        };
      })(),
    };
    await this.status.promise;
    // Note: It's unclear why, but in some situations (e.g. Playwright tests) the server
    // doesn't accept connections right away.
    for (let i = 0; ; i++) {
      try {
        await axios.get(`http://localhost:${this.options.port}`);
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

  async stop() {
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
    this.status = {
      kind: "stopping",
      promise: (async () => {
        await this.disposeObserver?.();
        this.disposeObserver = null;
        await this.viteManager?.stop();
        this.viteManager = null;
        await this.appServer?.stop();
        this.appServer = null;
        this.status = {
          kind: "stopped",
        };
      })(),
    };
    await this.status.promise;
  }
}

type PreviewerStatus =
  | {
      kind: "starting";
      promise: Promise<void>;
    }
  | {
      kind: "started";
    }
  | {
      kind: "stopping";
      promise: Promise<void>;
    }
  | {
      kind: "stopped";
    };

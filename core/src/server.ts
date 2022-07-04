import express from "express";
import type http from "http";
import { createHttpTerminator, HttpTerminator } from "http-terminator";

export class Server {
  private readonly app: express.Application;
  private serverTerminator: HttpTerminator | null = null;
  private server: http.Server | null = null;

  constructor(options: { middlewares: express.RequestHandler[] }) {
    const app = express();
    app.use((_req, res, next) => {
      // Disable caching.
      // This helps ensure that we don't end up with issues such as when
      // assets are updated, or a new version of Preview.js is used.
      res.setHeader("Cache-Control", "max-age=0, must-revalidate");
      next();
    });
    for (const middleware of options.middlewares) {
      app.use(middleware);
    }
    this.app = app;
  }

  async start(port: number) {
    return new Promise<http.Server>((resolve) => {
      const server = (this.server = this.app.listen(port, () => {
        console.log(`Preview.js Server running at http://localhost:${port}.`);
        resolve(server);
      }));
      this.serverTerminator = createHttpTerminator({
        server: this.server,
        gracefulTerminationTimeout: 0,
      });
    });
  }

  async stop() {
    if (this.serverTerminator) {
      await this.serverTerminator.terminate();
      this.serverTerminator = null;
    }
    if (this.server) {
      const server = this.server;
      await new Promise((resolve) => server.close(resolve));
      this.server = null;
    }
    console.log(`Preview.js Server stopped.`);
  }
}

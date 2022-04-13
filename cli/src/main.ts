#!/usr/bin/env node

import { PersistedState } from "@previewjs/api";
import * as core from "@previewjs/core";
import { init } from "@previewjs/loader";
import setupEnvironment from "@previewjs/pro";
import * as vfs from "@previewjs/vfs";
import { program } from "commander";
import { readFileSync } from "fs";

const { version } = JSON.parse(
  readFileSync(`${__dirname}/../package.json`, "utf8")
);

program.version(version);

const PORT_OPTION = [
  "-p, --port <port>",
  "Port number on which to run the Preview.js server",
  "8120",
] as const;
const VERBOSE_OPTION = [
  "-v, --verbose",
  "Enable verbose logging",
  false,
] as const;
interface SharedOptions {
  port: string;
  verbose: boolean;
}

program
  .arguments("[dir-path]")
  .option(...PORT_OPTION)
  .option(...VERBOSE_OPTION)
  .action(async (dirPath: string | undefined, options: SharedOptions) => {
    const previewjs = await init(core, vfs, async ({ rootDirPath }) => {
      const env = await setupEnvironment({ rootDirPath });
      return {
        ...env,
        persistedStateManager: {
          get: async (_, req) => {
            const cookie = req.cookies["state"];
            if (cookie) {
              return JSON.parse(cookie);
            }
            return {};
          },
          update: async (partialState, req, res) => {
            const existingCookie = req.cookies["state"];
            let existingState: PersistedState = {};
            if (existingCookie) {
              existingState = JSON.parse(existingCookie);
            }
            const state = {
              ...existingState,
              ...partialState,
            };
            res.cookie("state", JSON.stringify(state), {
              maxAge: 1000 * 3600 * 24 * 365,
              httpOnly: true,
              sameSite: "strict",
            });
            return state;
          },
        },
      };
    });
    const workspace = await previewjs.getWorkspace({
      versionCode: `cli-${version}`,
      absoluteFilePath: dirPath || process.cwd(),
      logLevel: "info",
    });
    if (!workspace) {
      throw new Error(`No supported framework was detected in ${dirPath}`);
    }
    const port = parseInt(options.port);
    await workspace.preview.start(async () => port);
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});

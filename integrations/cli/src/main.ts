#!/usr/bin/env node

import type * as api from "@previewjs/api";
import { startPreview } from "@previewjs/chromeless";
import { load } from "@previewjs/loader";
import reactPlugin from "@previewjs/plugin-react";
import chalk from "chalk";
import { program } from "commander";
import { readFileSync } from "fs";
import open from "open";
import path from "path";
import playwright from "playwright";

const { version } = JSON.parse(
  readFileSync(`${__dirname}/../package.json`, "utf8")
);

program.version(version);

const PORT_OPTION = [
  "-p, --port <port>",
  "Port number on which to run the Preview.js server",
  "8120",
] as const;

interface SharedOptions {
  port: string;
}

program
  .arguments("[dir-path]")
  .option(...PORT_OPTION)
  .action(async (dirPath: string | undefined, options: SharedOptions) => {
    if ("test") {
      const browser = await playwright.chromium.launch();
      const page = await browser.newPage();
      const preview = await startPreview({
        // TODO: Detect root directory.
        rootDirPath: dirPath || process.cwd(),
        // TODO: Auto-pass framework plugin factories, or get them from config.
        frameworkPluginFactories: [reactPlugin],
        page,
        port: 3123,
      });
      for (const componentId of await preview.detectComponents()) {
        try {
          await preview.show(componentId);
          await preview.iframe.takeScreenshot(
            path.join(
              __dirname,
              "__screenshots__",
              componentId.split(":")[1] + ".png"
            )
          );
          console.log(`✅ ${componentId}`);
        } catch (e: any) {
          console.log(`❌ ${componentId}`);
          // TODO: Show if verbose on.
          // console.warn(e.message);
        }
      }
      await preview.stop();
      console.log("Done!");
      process.exit(0);
    }

    const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
    if (!packageName) {
      throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
    }
    const previewjs = await load({
      installDir: process.env.PREVIEWJS_MODULES_DIR || __dirname,
      packageName,
    });
    const workspace = await previewjs.getWorkspace({
      versionCode: `cli-${version}`,
      absoluteFilePath: dirPath || process.cwd(),
      persistedStateManager: {
        get: async (req) => {
          const cookie = req.cookies["state"];
          if (cookie) {
            return JSON.parse(cookie);
          }
          return {};
        },
        update: async (req, res) => {
          const existingCookie = req.cookies["state"];
          let existingState: api.PersistedState = {};
          if (existingCookie) {
            existingState = JSON.parse(existingCookie);
          }
          const state = {
            ...existingState,
            ...req.body,
          };
          res.cookie("state", JSON.stringify(state), {
            httpOnly: true,
            sameSite: "strict",
          });
          return state;
        },
      },
    });
    if (!workspace) {
      console.error(chalk.red(`No workspace detected.`));
      process.exit(1);
    }

    const port = parseInt(options.port);
    await workspace!.preview.start(async () => port);
    await open(`http://localhost:${port}`);
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});

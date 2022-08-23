#!/usr/bin/env node

import type * as api from "@previewjs/api";
import { load } from "@previewjs/loader";
import chalk from "chalk";
import { program } from "commander";
import { readFileSync } from "fs";
import { prompt, registerPrompt } from "inquirer";
import autocompletePrompt from "inquirer-autocomplete-prompt";
import open from "open";

registerPrompt("autocomplete", autocompletePrompt);

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

const noComponentOption = chalk.blueBright("Skip component selection");
const forceRefreshOption = chalk.magenta("Refresh component list");

program
  .arguments("[dir-path]")
  .option(...PORT_OPTION)
  .action(async (dirPath: string | undefined, options: SharedOptions) => {
    const previewjs = await initializePreviewJs();
    const workspace = await previewjs.getWorkspace({
      versionCode: `cli-${version}`,
      logLevel: "info",
      absoluteFilePath: dirPath || process.cwd(),
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
          let existingState: api.PersistedState = {};
          if (existingCookie) {
            existingState = JSON.parse(existingCookie);
          }
          const state = {
            ...existingState,
            ...partialState,
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
    await promptComponent();

    async function promptComponent(forceRefresh = false): Promise<void> {
      console.log(`Analyzing project for components...`);
      const { components, cached } = await workspace!.components.list({
        forceRefresh,
      });
      if (cached) {
        console.log(`Using cached component list from previous run.`);
      }
      const allComponents = Object.entries(components)
        .map(([filePath, fileComponents]) =>
          fileComponents.map((componentName) => ({
            filePath,
            componentName,
          }))
        )
        .flat();
      const { componentId } = await prompt([
        {
          type: "autocomplete",
          name: "componentId",
          message: "Select a component",
          source: (_: unknown, input = "") => [
            ...(!input ? [noComponentOption, forceRefreshOption] : []),
            ...allComponents
              .filter(
                ({ filePath, componentName }) =>
                  filePath.toLowerCase().includes(input.toLowerCase()) ||
                  componentName.toLowerCase().includes(input.toLowerCase())
              )
              .map(
                ({ filePath, componentName }) => `${filePath}:${componentName}`
              ),
          ],
        },
      ]);
      if (componentId === forceRefreshOption) {
        return promptComponent(true);
      }
      await workspace!.preview.start(async () => port);
      const pathSuffix =
        componentId === noComponentOption ? "" : `/?p=${componentId}`;
      await open(`http://localhost:${port}${pathSuffix}`);
    }
  });

async function initializePreviewJs() {
  const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }

  return load({
    installDir: process.env.PREVIEWJS_MODULES_DIR || __dirname,
    packageName,
  });
}

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});

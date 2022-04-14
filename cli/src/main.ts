#!/usr/bin/env node

import { PersistedState } from "@previewjs/api";
import { readConfig } from "@previewjs/config";
import * as core from "@previewjs/core";
import * as vfs from "@previewjs/vfs";
import chalk from "chalk";
import { program } from "commander";
import { readFileSync } from "fs";
import { prompt, registerPrompt } from "inquirer";
import autocompletePrompt from "inquirer-autocomplete-prompt";
import open from "open";
import path from "path";

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
    const rootDirPath = path.resolve(dirPath || process.cwd());
    let setupEnvironment: core.SetupPreviewEnvironment;
    try {
      // @ts-ignore
      setupEnvironment = (await import("@previewjs/pro")).default;
    } catch {
      console.log(
        chalk.cyan(
          `Optional peer dependency @previewjs/pro not detected. Falling back to @previewjs/app instead.\n`
        )
      );
      setupEnvironment = (await import("@previewjs/app")).default;
    }
    const previewEnv = await setupEnvironment({ rootDirPath });
    const frameworkPlugin = await readConfig(rootDirPath).frameworkPlugin;
    if (!frameworkPlugin) {
      console.error(
        `${chalk.red(
          `No framework plugin found.`
        )} Please set it up in preview.config.js.\n\n${chalk.green(
          `See https://previewjs.com/docs/config/framework-plugin for more info.`
        )}`
      );
      process.exit(1);
    }
    const workspace = await core.createWorkspace({
      versionCode: `cli-${version}`,
      logLevel: "info",
      rootDirPath,
      reader: vfs.createFileSystemReader(),
      frameworkPlugin,
      middlewares: previewEnv.middlewares || [],
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
            httpOnly: true,
            sameSite: "strict",
          });
          return state;
        },
      },
      onReady: previewEnv.onReady?.bind(previewEnv),
    });
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
          fileComponents.map(({ componentName, exported }) => ({
            filePath,
            componentName,
            exported,
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

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});

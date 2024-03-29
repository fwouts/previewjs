#!/usr/bin/env node

import { load } from "@previewjs/loader";
import chalk from "chalk";
import { program } from "commander";
import { readFileSync } from "fs";
import path from "path";
import url from "url";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
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
    const onServerStartModuleName = process.env.PREVIEWJS_PACKAGE_NAME;
    const previewjs = await load({
      installDir: process.env.PREVIEWJS_MODULES_DIR || __dirname,
      workerFilePath: path.join(
        __dirname,
        process.env.WORKER_FILE_NAME || "worker.js"
      ),
      onServerStartModuleName,
    });
    await previewjs.inWorkspace({
      versionCode: `cli-${version}`,
      absoluteFilePath: dirPath || process.cwd(),
      run: async (workspace) => {
        if (!workspace) {
          previewjs.logger.error(chalk.red(`No workspace detected.`));
          process.exit(1);
        }
        const port = parseInt(options.port);
        await workspace.startServer({ port });
      },
    });
  });

program.parseAsync(process.argv).catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

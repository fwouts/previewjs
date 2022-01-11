#!/usr/bin/env node

import { load } from "@previewjs/loader";
import { program } from "commander";
import { readFileSync } from "fs";
import path from "path";

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
    const previewjs = await load({
      installDir: path.join(__dirname, "installed"),
      status: {
        info: console.log,
        error: console.error,
      },
    });
    const workspace = await previewjs.getWorkspace({
      versionCode: `cli-${version}`,
      filePath: dirPath || process.cwd(),
      logLevel: "info",
    });
    if (!workspace) {
      throw new Error(`No supported framework was detected in ${dirPath}`);
    }
    const port = parseInt(options.port);
    await workspace.preview.start(async () => port);
    console.log(`Ready at http://localhost:${port}`);
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});

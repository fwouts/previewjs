import fs from "fs";
import path from "path";
import { PreviewConfig } from "./config";

export const PREVIEW_CONFIG_NAME = "preview.config.js";

export function readConfig(rootDirPath: string): PreviewConfig {
  const rpConfigPath = path.join(rootDirPath, PREVIEW_CONFIG_NAME);
  let config: Partial<PreviewConfig> = {};
  const configFileExists = fs.existsSync(rpConfigPath);
  if (configFileExists) {
    // Delete any existing cache so we reload the config fresh.
    // @ts-ignore
    delete require.cache[
      // @ts-ignore
      require.resolve(rpConfigPath)
    ];
    // @ts-ignore
    const required = require(/* webpackIgnore: true */ rpConfigPath);
    config = required.module || required;
  }
  return {
    alias: {},
    publicDir: "public",
    ...config,
  };
}

import fs from "fs";
import { createRequire } from "module";
import path from "path";
import type { PreviewConfig } from "./config";

const require = createRequire(import.meta.url);

export const PREVIEW_CONFIG_NAME = "preview.config.js";

export function readConfig(rootDirPath: string): PreviewConfig {
  const rpConfigPath = path.join(rootDirPath, PREVIEW_CONFIG_NAME);
  let config: Partial<PreviewConfig> = {};
  const configFileExists = fs.existsSync(rpConfigPath);
  if (configFileExists) {
    // Delete any existing cache so we reload the config fresh.
    delete require.cache[require.resolve(rpConfigPath)];
    const required = require(rpConfigPath);
    config = required.module || required;
  }
  return {
    alias: {},
    publicDir: "public",
    ...config,
  };
}

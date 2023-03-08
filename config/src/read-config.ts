import fs from "fs";
import { createRequire } from "module";
import path from "path";
import type { PreviewConfig } from "./config";

const require = createRequire(import.meta.url);

export const PREVIEW_CONFIG_NAME = "preview.config.js";

export async function readConfig(rootDirPath: string): Promise<PreviewConfig> {
  const rpConfigPath = path.join(rootDirPath, PREVIEW_CONFIG_NAME);
  let config: Partial<PreviewConfig> = {};
  const configFileExists = fs.existsSync(rpConfigPath);
  if (configFileExists) {
    let isModule = false;
    const packageJsonPath = path.join(rootDirPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const { type } = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      isModule = type === "module";
    }
    // Delete any existing cache so we reload the config fresh.
    delete require.cache[require.resolve(rpConfigPath)];
    const required = isModule
      ? await import(rpConfigPath)
      : require(rpConfigPath);
    config = required.module || required;
  }
  return {
    alias: {},
    publicDir: "public",
    ...config,
  };
}

import fs from "fs";
import { createRequire } from "module";
import path from "path";
import url from "url";
import type { PreviewConfig } from "./config";

const require = createRequire(import.meta.url);

export const PREVIEW_CONFIG_NAME = "preview.config.js";

export async function readConfig(rootDirPath: string): Promise<PreviewConfig> {
  const configPath = path.join(rootDirPath, PREVIEW_CONFIG_NAME);
  let config: Partial<PreviewConfig> = {};
  const configFileExists = fs.existsSync(configPath);
  if (configFileExists) {
    let isModule = false;
    const packageJsonPath = path.join(rootDirPath, "package.json");
    if (fs.existsSync(packageJsonPath)) {
      const { type } = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
      isModule = type === "module";
    }
    try {
      return await loadModule(configPath, isModule);
    } catch (e) {
      // Try again but with the other type of module.
      try {
        return await loadModule(configPath, !isModule);
      } catch {
        // Throw the original error if not working.
        throw new Error(`Unable to read preview.config.js:\n${e}`);
      }
    }
  }
  return {
    alias: {},
    publicDir: "public",
    ...config,
  };
}

async function loadModule(configPath: string, asModule: boolean) {
  if (asModule) {
    const module = await import(
      `${url.pathToFileURL(configPath).href}?ts=${Date.now()}`
    );
    return module.default;
  } else {
    // Delete any existing cache so we reload the config fresh.
    delete require.cache[require.resolve(configPath)];
    const required = require(configPath);
    return required.module || required;
  }
}

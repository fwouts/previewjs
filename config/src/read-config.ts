import fs from "fs";
import path from "path";
import { loadConfigFromFile, type LogLevel } from "vite";
import type { PreviewConfig } from "./config";

export const PREVIEW_CONFIG_NAMES = [
  "preview.config.js",
  "preview.config.mjs",
  "preview.config.ts",
  "preview.config.cjs",
  "preview.config.mts",
  "preview.config.cts",
];

export async function readConfig(
  rootDir: string,
  logLevel: LogLevel
): Promise<PreviewConfig> {
  let config: Partial<PreviewConfig> = {};
  for (const configName of PREVIEW_CONFIG_NAMES) {
    const configPath = path.join(rootDir, configName);
    const configFileExists = fs.existsSync(configPath);
    if (configFileExists) {
      try {
        const loaded = await loadConfigFromFile(
          {
            command: "serve",
            mode: "development",
          },
          configName,
          rootDir,
          logLevel
        );
        if (loaded) {
          config = loaded.config as Partial<PreviewConfig>;
          break;
        }
      } catch (e: any) {
        if (
          typeof e.message === "string" &&
          e.message.includes("config must export or return an object")
        ) {
          throw new Error(`Please use a default export in preview.config.js`);
        } else {
          throw e;
        }
      }
    }
  }
  return config;
}

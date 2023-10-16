import type { Analyzer } from "@previewjs/analyzer-api";
import type { Reader } from "@previewjs/vfs";
import type { Logger } from "pino";
import type vite from "vite";
import type { PackageDependencies } from "./dependencies";

export interface FrameworkPluginFactory {
  /** This will always be set in current plugin versions. */
  info?: FrameworkPluginInfo;
  isCompatible(dependencies: PackageDependencies): Promise<boolean>;
  create(options: {
    rootDir: string;
    reader: Reader;
    logger: Logger;
    dependencies: PackageDependencies;
  }): Promise<FrameworkPlugin>;
}

export interface FrameworkPlugin extends Analyzer {
  defaultWrapperPath: string;
  previewDirPath: string;
  viteConfig: (configuredPlugins: vite.Plugin[]) => vite.UserConfig;
  dispose(): void;
}

type FrameworkPluginInfo = {
  name: string;
  apiVersion: number;
};

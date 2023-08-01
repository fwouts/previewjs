import type { ComponentDetector } from "@previewjs/component-detection-api";
import type { Reader } from "@previewjs/vfs";
import type { Logger } from "pino";
import type vite from "vite";
import type { PackageDependencies } from "./dependencies";

export interface FrameworkPluginFactory {
  isCompatible(dependencies: PackageDependencies): Promise<boolean>;
  create(options: {
    rootDirPath: string;
    reader: Reader;
    logger: Logger;
    dependencies: PackageDependencies;
  }): Promise<FrameworkPlugin>;
}

export interface FrameworkPlugin extends ComponentDetector {
  readonly pluginApiVersion?: number;
  readonly name: string;
  readonly defaultWrapperPath: string;
  readonly previewDirPath: string;
  readonly viteConfig: (configuredPlugins: vite.Plugin[]) => vite.UserConfig;
  dispose(): void;
}

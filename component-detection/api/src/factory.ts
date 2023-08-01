import { createFileSystemReader } from "@previewjs/vfs";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import type { ComponentDetector, ComponentDetectorFactory } from "./api";

type ComponentDetectorFactoryOptions = Exclude<
  Parameters<ComponentDetectorFactory>[0],
  undefined
>;

export function factoryWithDefaultOptions(
  factory: (
    options: Required<ComponentDetectorFactoryOptions>
  ) => ComponentDetector
): ComponentDetectorFactory {
  return (options: ComponentDetectorFactoryOptions = {}) =>
    factory({
      rootDirPath: options.rootDirPath || process.cwd(),
      reader: options.reader || createFileSystemReader(),
      logger:
        options.logger ||
        createLogger({ level: "debug" }, prettyLogger({ colorize: true })),
    });
}

import { createFileSystemReader } from "@previewjs/vfs";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import type { ComponentDetector, ComponentDetectorFactory } from "./api";

type ComponentDetectorFactoryOptions = Parameters<ComponentDetectorFactory>[0];

export function factoryWithDefaultOptions(
  factory: (
    options: Required<ComponentDetectorFactoryOptions>
  ) => ComponentDetector
): ComponentDetectorFactory {
  return (options: ComponentDetectorFactoryOptions) =>
    factory({
      ...options,
      reader: options.reader || createFileSystemReader(),
      logger:
        options.logger ||
        createLogger({ level: "debug" }, prettyLogger({ colorize: true })),
    });
}

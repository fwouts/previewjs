import { createFileSystemReader } from "@previewjs/vfs";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import type { ComponentAnalyzer, ComponentAnalyzerFactory } from "./api";

type ComponentAnalyzerFactoryOptions = Parameters<ComponentAnalyzerFactory>[0];

export function factoryWithDefaultOptions(
  factory: (
    options: Required<ComponentAnalyzerFactoryOptions>
  ) => ComponentAnalyzer
): ComponentAnalyzerFactory {
  return (options: ComponentAnalyzerFactoryOptions) =>
    factory({
      ...options,
      reader: options.reader || createFileSystemReader(),
      logger:
        options.logger ||
        createLogger({ level: "debug" }, prettyLogger({ colorize: true })),
    });
}

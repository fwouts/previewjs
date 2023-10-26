import { createFileSystemReader } from "@previewjs/vfs";
import { pino as createLogger } from "pino";
import { PinoPretty as prettyLogger } from "pino-pretty";
import type { Analyzer, AnalyzerFactory } from "./api.js";

type AnalyzerFactoryOptions = Parameters<AnalyzerFactory>[0];

export function factoryWithDefaultOptions(
  factory: (options: Required<AnalyzerFactoryOptions>) => Analyzer
): AnalyzerFactory {
  return (options: AnalyzerFactoryOptions) =>
    factory({
      ...options,
      reader: options.reader || createFileSystemReader(),
      logger:
        options.logger ||
        createLogger({ level: "debug" }, prettyLogger({ colorize: true })),
    });
}

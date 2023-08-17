import { createFileSystemReader } from "@previewjs/vfs";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import type { Analyzer, AnalyzerFactory } from "./api";

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

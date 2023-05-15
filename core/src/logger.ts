import type vite from "vite";

export enum LogLevel {
  SILENT = 5,
  ERROR = 4,
  WARN = 3,
  INFO = 2,
  DEBUG = 1,
}

export interface Logger {
  error(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  debug(message: string, ...args: unknown[]): void;
  viteLogLevel(): vite.LogLevel;
}

export function createLogger(level: LogLevel): Logger {
  return new LoggerImpl(level);
}

class LoggerImpl implements Logger {
  constructor(private readonly level: LogLevel) {}

  error(message: string, ...args: unknown[]) {
    if (this.level <= LogLevel.ERROR) {
      console.error(message, ...args);
    }
  }

  warn(message: string, ...args: unknown[]) {
    if (this.level <= LogLevel.WARN) {
      console.warn(message, ...args);
    }
  }

  info(message: string, ...args: unknown[]) {
    if (this.level <= LogLevel.INFO) {
      console.info(message, ...args);
    }
  }

  debug(message: string, ...args: unknown[]) {
    if (this.level <= LogLevel.DEBUG) {
      console.debug(message, ...args);
    }
  }

  viteLogLevel(): vite.LogLevel {
    switch (this.level) {
      case LogLevel.SILENT:
        return "silent";
      case LogLevel.ERROR:
        return "error";
      case LogLevel.WARN:
        return "warn";
      case LogLevel.INFO:
      case LogLevel.DEBUG:
      default:
        return "info";
    }
  }
}

/* eslint-disable no-console */
import { revertToEarlierSnapshot } from ".";
import type { LogLevel } from "../../src";
import { generateMessageFromError } from "./error-message";
// @ts-ignore
import inspect from "./object-inspect";

// Note: this must be kept in sync with
// https://github.com/vitejs/vite/blob/2de425d0288bfae345c5ced5c84cf67ffccaef48/packages/vite/src/client/client.ts#L117
const HMR_FAILED_UPDATE_REGEX =
  /^\[hmr\] Failed to reload (.+)\. This could be due to syntax errors or importing non-existent modules\. \(see errors above\)$/;

export function setUpLogInterception() {
  // This is a hack to intercept errors logged here: https://github.com/vitejs/vite/blob/2de425d0288bfae345c5ced5c84cf67ffccaef48/packages/vite/src/client/client.ts#L115
  //
  // An example where this will occur is when importing a module
  // that throws an error in its root body.
  let consoleErrorPrecedingHmrError: string | null = null;
  const makeLogger =
    (level: LogLevel, defaultFn: typeof console.log) =>
    (...args: any[]) => {
      // Prevent an infinite call stack size if anything here logs.
      const self = console[level];
      console[level] = defaultFn;
      defaultFn(...args);
      try {
        const firstArg = args[0];
        if (typeof firstArg === "string") {
          if (firstArg.startsWith("[vite]")) {
            // Silence.
            return;
          }
          const hmrMatch = firstArg.match(HMR_FAILED_UPDATE_REGEX);
          if (hmrMatch) {
            // const modulePath = hmrMatch[1]!;
            // const errorMessage = `Failed to reload ${modulePath}`;
            // if (consoleErrorPrecedingHmrError) {
            //   window.__PREVIEWJS_IFRAME__.reportEvent({
            //     kind: "error",
            //     source: "hmr",
            //     modulePath,
            //     message: generateMessageFromError(
            //       errorMessage,
            //       consoleErrorPrecedingHmrError
            //     ),
            //   });
            // } else {
            //   window.__PREVIEWJS_IFRAME__.reportEvent({
            //     kind: "error",
            //     source: "hmr",
            //     modulePath,
            //     message: errorMessage,
            //   });
            // }
            revertToEarlierSnapshot();
            return;
          }
        }
        consoleErrorPrecedingHmrError = null;
        if (
          level === "error" &&
          args.length === 1 &&
          firstArg instanceof Error &&
          new Error().stack?.includes("warnFailedFetch")
        ) {
          consoleErrorPrecedingHmrError = generateMessageFromError(
            firstArg.message,
            firstArg.stack
          );
          return;
        }
        window.__PREVIEWJS_IFRAME__.reportEvent({
          kind: "log-message",
          level,
          message: formatLogMessage(...args),
        });
      } finally {
        console[level] = self;
      }
    };
  console.log = makeLogger("log", console.log);
  console.info = makeLogger("info", console.info);
  console.warn = makeLogger("warn", console.warn);
  console.error = makeLogger("error", console.error);
  window.onerror = (message, source, lineno, colno, error) => {
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "error",
      source: "renderer",
      message: formatError(error, message),
    });
  };
  window.onunhandledrejection = (event) => {
    const message = formatError(event.reason);
    if (
      message.includes("Failed to fetch dynamically imported module") ||
      message.includes("Failed to reload")
    ) {
      return;
    }
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "error",
      source: "renderer",
      message,
    });
  };
}

function formatError(error?: any, message?: any): string {
  if (error && error.stack && error.message) {
    message = error.stack;
    if (!message?.includes(error.message)) {
      message = error.message + "\n" + message;
    }
    return message;
  } else if (message) {
    return `${message}`;
  } else {
    return `${error}`;
  }
}

function formatLogMessage(...args: any[]) {
  if (args.length === 0) {
    return "";
  }
  let message = formatValue(args.shift());
  message = message.replace(/%s/g, () => formatValue(args.shift()));
  return [message, ...args.map(formatValue)].join(" ");
}

function formatValue(value: any) {
  if (typeof value === "string") {
    return value;
  }
  const formatted = inspect(value);
  if (typeof formatted !== "string") {
    // This can happen in rare cases e.g. toString() not actually returning a string.
    try {
      return JSON.stringify(value);
    } catch {
      return "[Unable to represent value as string]";
    }
  }
  if (formatted.at(0) === "[" && formatted.at(-1) === "]") {
    return formatted.substring(1, formatted.length - 1);
  }
  return formatted;
}

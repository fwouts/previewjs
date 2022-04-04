import { LogLevel } from "../..";
import { sendMessageFromPreview } from "./messages";
import inspect from "./object-inspect";

export function setUpLogInterception() {
  const makeLogger =
    (level: LogLevel, defaultFn: typeof console.log) =>
    (...args: any[]) => {
      // Prevent an infinite call stack size if anything here logs.
      const self = console[level];
      console[level] = defaultFn;
      defaultFn(...args);
      try {
        const firstArg = args[0];
        if (
          typeof firstArg === "string" &&
          (firstArg.includes("[hmr]") || firstArg.startsWith("[vite]"))
        ) {
          if (firstArg.startsWith("[hmr] Failed to reload")) {
            sendMessageFromPreview({
              kind: "vite-logs-error",
              message: firstArg.slice(6).replace(" (see errors above)", "."), // remove [hmr] and confusing message
            });
          }
          // if (firstArg.startsWith("[vite] Internal Server Error")) {
          //   sendMessageFromPreview({
          //     kind: "vite-logs-error",
          //     message: firstArg.slice(39), // remove [vite] Internal Server Error prefix
          //   });
          // }
          // Silence.
          return;
        }
        // This is a hack to intercept errors thrown in a module fetched by HMR.
        // It specifically aims to intercept errors logged at the following line:
        //
        // https://github.com/vitejs/vite/blob/50a876537cc7b934ec5c1d11171b5ce02e3891a8/packages/vite/src/client/client.ts#L31
        //
        // This can easily break with new releases of Vite.js.
        // Yes, there are tests to make sure that doesn't happen :)
        if (
          level === "error" &&
          args.length === 1 &&
          firstArg instanceof Error &&
          new Error().stack.includes("warnFailedFetch")
        ) {
          // An example where this will occur is when importing a module
          // that throws an error in its root body.
          //
          // Note: this isn't quite a Vite error. This works though.
          sendMessageFromPreview({
            kind: "vite-error",
            payload: {
              type: "error",
              err: {
                message: firstArg.message,
                stack: firstArg.stack,
              },
            },
          });
          return;
        }
        const timestamp = Date.now();
        sendMessageFromPreview({
          kind: "log-message",
          timestamp,
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
  return inspect(value);
}

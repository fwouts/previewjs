import { LogLevel } from "../..";
import { sendMessageFromPreview } from "./messages";

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
          (firstArg.toLowerCase().includes("[hmr]") ||
            firstArg.toLowerCase().startsWith("[vite]"))
        ) {
          // Silence.
          return;
        }
        if (
          level === "error" &&
          args.length === 1 &&
          firstArg instanceof Error
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
  console.warn = makeLogger("warn", console.warn);
  console.error = makeLogger("error", console.error);
}

function formatLogMessage(...args: any[]) {
  if (args.length === 0) {
    return "";
  }
  let message = toString(args.shift());
  message = message.replace(/%s/g, () => toString(args.shift()));
  return [message, ...args.map(toString)].join(" ");
}

function toString(value: any) {
  // Note: this doesn't use value.toString() because this may not exist.
  if (value instanceof Error && value.stack) {
    return value.stack;
  }
  return `${value}`;
}

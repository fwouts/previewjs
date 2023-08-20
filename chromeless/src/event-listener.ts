import type { PreviewToAppMessage } from "@previewjs/iframe";
import type { Page } from "playwright";
import type { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";

export async function setupPreviewEventListener(
  page: Page,
  listener: (event: PreviewEvent) => void
) {
  let recorded: PreviewEvent[] = [];
  const events = {
    clear() {
      recorded = [];
    },
    get() {
      return [...recorded];
    },
  };
  await page.exposeFunction(
    "__previewjs_iframe_listener__",
    (data: PreviewToAppMessage) => {
      const events = ((): PreviewEvent[] => {
        switch (data.kind) {
          case "before-render":
          case "action":
          case "log-message":
          case "file-changed":
            return [data];
          case "rendering-setup":
            return [
              {
                kind: "rendering-setup",
              },
            ];
          case "rendering-success":
            return [
              {
                kind: "rendering-done",
                success: true,
              },
            ];
          case "rendering-error":
            return [
              {
                kind: "log-message",
                level: "error",
                timestamp: Date.now(),
                message: data.message,
              },
              {
                kind: "rendering-done",
                success: false,
              },
            ];
          case "vite-error":
            return [
              {
                kind: "log-message",
                level: "error",
                timestamp: Date.now(),
                message: generateMessageFromViteError(data.payload.err),
              },
            ];
          case "vite-before-update":
            return [
              {
                kind: "before-vite-update",
                payload: data.payload,
              },
            ];
          default:
            return [];
        }
      })();
      for (const event of events) {
        recorded.push(event);
        return listener(event);
      }
    }
  );
  return events;
}

// TODO: Deduplicate.
function generateMessageFromViteError(err: ErrorPayload["err"]) {
  let message = err.message + (err.stack ? `\n${err.stack}` : "");
  // Remove any redundant line breaks (but not spaces,
  // which could be useful indentation).
  message = message.replace(/^\n+/g, "\n").trim();
  const stripPrefix = "Internal server error: ";
  if (message.startsWith(stripPrefix)) {
    message = message.substr(stripPrefix.length);
  }
  if (/^Transform failed with \d+ errors?:?\n.*/.test(message)) {
    const lineBreakPosition = message.indexOf("\n");
    message = message.substring(lineBreakPosition + 1);
  }
  const lineBreakPosition = message.indexOf("\n");
  let title: string;
  let rest: string;
  if (lineBreakPosition > -1) {
    title = message.substr(0, lineBreakPosition).trim();
    rest = message.substr(lineBreakPosition + 1);
  } else {
    title = message;
    rest = "";
  }
  if (title.endsWith(":") || title.endsWith(".")) {
    title = title.substr(0, title.length - 1).trim();
  }
  // Note: this isn't relevant to all browsers.
  if (rest.startsWith(`Error: ${title}\n`)) {
    rest = rest.substr(rest.indexOf("\n") + 1);
  }
  return `${title}${rest ? `\n\n${rest}` : ""}`;
}

export type PreviewEvent =
  | PreviewBootstrapped
  | BeforeViteUpdate
  | BeforeRender
  | RenderingSetup
  | RenderingDone
  | Action
  | LogMessage
  | FileChanged;

export type PreviewBootstrapped = {
  kind: "bootstrapped";
};

export type BeforeViteUpdate = {
  kind: "before-vite-update";
  payload: UpdatePayload;
};

export type BeforeRender = {
  kind: "before-render";
};

export type RenderingSetup = {
  kind: "rendering-setup";
};

export interface RenderingDone {
  kind: "rendering-done";
  success: boolean;
}

export interface Action {
  kind: "action";
  type: "fn" | "url";
  path: string;
}

export interface LogMessage {
  kind: "log-message";
  timestamp: number;
  level: LogLevel;
  message: string;
}

export type LogLevel = "log" | "info" | "warn" | "error";

export interface FileChanged {
  kind: "file-changed";
  path: string;
}

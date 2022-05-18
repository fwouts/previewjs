import type { ErrorPayload } from "vite/types/hmrPayload";
import type {
  AppToPreviewMessage,
  PreviewToAppMessage,
} from "./preview/__previewjs_internal__/messages";

export function createController(options: {
  getIframe: () => HTMLIFrameElement | null;
  listener(event: PreviewEvent): void;
}): PreviewIframeController {
  return new PreviewIframeControllerImpl(options);
}

export interface PreviewIframeController {
  start(): void;
  stop(): void;
  showLoading(): void;
  loadComponent(options: LoadComponentOptions): void;
}

export interface LoadComponentOptions {
  filePath: string;
  componentName: string;
  variantKey: string | null;
  customVariantPropsSource: string;
  defaultPropsSource: string;
}

class PreviewIframeControllerImpl implements PreviewIframeController {
  private previewBootstrapped = false;
  private waitingForBootstrapped = false;
  private lastMessage: AppToPreviewMessage | null = null;
  private expectRenderTimeout?: any;

  constructor(
    private readonly options: {
      getIframe: () => HTMLIFrameElement | null;
      listener(event: PreviewEvent): void;
    }
  ) {}

  start() {
    window.addEventListener("message", this.onWindowMessage);
    this.resetIframe();
  }

  stop() {
    window.removeEventListener("message", this.onWindowMessage);
  }

  showLoading() {
    this.send({
      kind: "show-loading",
    });
  }

  loadComponent(options: LoadComponentOptions) {
    this.send({
      kind: "render",
      ...options,
    });
  }

  private send(message: AppToPreviewMessage) {
    this.lastMessage = message;
    if (!this.previewBootstrapped && !this.waitingForBootstrapped) {
      this.resetIframe();
      return;
    }
    const iframeWindow = this.options.getIframe()?.contentWindow;
    if (!iframeWindow) {
      return;
    }
    iframeWindow.postMessage(message, document.location.href);
    if (message.kind === "render") {
      this.clearExpectRenderTimeout();
      this.expectRenderTimeout = setTimeout(() => {
        console.warn(
          "Expected render did not occur after 5 seconds. Reloading iframe..."
        );
        this.resetIframe();
      }, 5000);
    }
  }

  private resetIframe() {
    const iframe = this.options.getIframe();
    this.previewBootstrapped = false;
    if (!iframe) {
      return;
    }
    this.waitingForBootstrapped = true;
    iframe.src = `/preview/?t=${Date.now()}`;
  }

  private onWindowMessage = (event: MessageEvent<PreviewToAppMessage>) => {
    const data = event.data;
    const { listener } = this.options;
    switch (data.kind) {
      case "bootstrapped":
        this.onBootstrapped();
        break;
      case "before-render":
      case "action":
      case "log-message":
        listener(data);
        break;
      case "renderer-updated":
        this.clearExpectRenderTimeout();
        listener({
          kind: "update",
          rendering: {
            kind: "success",
            variantKey: data.variantKey,
            variants: data.variants,
          },
        });
        break;
      case "rendering-error":
        this.clearExpectRenderTimeout();
        listener({
          kind: "log-message",
          level: "error",
          timestamp: Date.now(),
          message: data.message,
        });
        break;
      case "vite-error":
        listener({
          kind: "log-message",
          level: "error",
          timestamp: Date.now(),
          message: generateMessageFromViteError(data.payload.err),
        });
        break;
      case "vite-before-update":
        listener({
          kind: "update",
          rendering: null,
        });
        break;
    }
  };

  private onBootstrapped() {
    this.previewBootstrapped = true;
    this.waitingForBootstrapped = false;
    if (this.lastMessage) {
      this.send(this.lastMessage);
    }
    this.options.listener({
      kind: "bootstrapped",
    });
  }

  private clearExpectRenderTimeout() {
    if (this.expectRenderTimeout) {
      clearTimeout(this.expectRenderTimeout);
      this.expectRenderTimeout = null;
    }
  }
}

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
  | BeforeRender
  | PreviewUpdate
  | Action
  | LogMessage;

export type PreviewBootstrapped = {
  kind: "bootstrapped";
};

export type BeforeRender = {
  kind: "before-render";
};

export type PreviewUpdate = {
  kind: "update";
  rendering:
    | {
        kind: "error";
        error: string;
      }
    | {
        kind: "success";
        variantKey: string;
        variants: Variant[];
      }
    | null;
};

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

export interface Variant {
  key: string;
  label: string;
  isEditorDriven?: boolean;
}

export type RendererLoader = (options: {
  wrapperModule: any;
  wrapperName?: string;
  componentFilePath: string;
  componentModule: any;
  componentName?: string;
}) => Promise<{
  variants: Array<
    Variant & {
      props?: any;
    }
  >;
  render: (props: any) => Promise<void>;
}>;

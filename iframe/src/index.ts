import type { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import type { PreviewToAppMessage } from "./messages";

declare global {
  const mount: JsxElementMounter;

  interface Window {
    mount: JsxElementMounter;

    // Exposed on the iframe.
    __PREVIEWJS_IFRAME__: {
      render(options: RenderOptions): Promise<void>;
    };
    // Typically exposed on the iframe's parent to track its state.
    __PREVIEWJS_CONTROLLER__: {
      onPreviewMessage(message: PreviewToAppMessage): void;
    };
  }
}

export interface RenderOptions {
  autogenCallbackPropsSource: string;
  propsAssignmentSource: string | (() => Record<string, unknown>);
}

export function createController(options: {
  getIframe: () => HTMLIFrameElement | null;
  listener(event: PreviewEvent): void;
}): PreviewIframeController {
  const controller = new PreviewIframeControllerImpl(options);
  window.__PREVIEWJS_CONTROLLER__ = controller;
  return controller;
}

export interface PreviewIframeController {
  render(previewableId: string, options: RenderOptions): void;
}

class PreviewIframeControllerImpl implements PreviewIframeController {
  private lastRender: {
    previewableId: string;
    options: RenderOptions;
  } | null = null;
  private expectRenderTimeout?: any;

  constructor(
    private readonly options: {
      getIframe: () => HTMLIFrameElement | null;
      listener(event: PreviewEvent): void;
    }
  ) {}

  async render(previewableId: string, options: RenderOptions) {
    const previousRender = this.lastRender;
    this.lastRender = { previewableId, options };
    if (previousRender?.previewableId !== previewableId) {
      this.resetIframe(previewableId);
      return;
    }
    const iframeWindow = this.options.getIframe()?.contentWindow;
    if (!iframeWindow) {
      return;
    }
    const renderPromise = iframeWindow.__PREVIEWJS_IFRAME__.render(options);
    this.clearExpectRenderTimeout();
    this.expectRenderTimeout = setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(
        "Expected render did not occur after 5 seconds. Reloading iframe..."
      );
      this.resetIframe(previewableId);
    }, 5000);
    await renderPromise;
  }

  resetIframe(id: string) {
    const iframe = this.options.getIframe();
    if (!iframe) {
      return;
    }
    iframe.src = `/preview/${id}/?t=${Date.now()}`;
  }

  onPreviewMessage(message: PreviewToAppMessage) {
    const { listener } = this.options;
    switch (message.kind) {
      case "bootstrapped":
        this.onBootstrapped();
        break;
      case "before-render":
      case "action":
      case "log-message":
      case "file-changed":
        listener(message);
        break;
      case "rendering-setup":
        listener({
          kind: "rendering-setup",
        });
        break;
      case "rendering-success":
        this.clearExpectRenderTimeout();
        listener({
          kind: "rendering-done",
          success: true,
        });
        break;
      case "rendering-error":
        this.clearExpectRenderTimeout();
        listener({
          kind: "log-message",
          level: "error",
          timestamp: Date.now(),
          message: message.message,
        });
        listener({
          kind: "rendering-done",
          success: false,
        });
        break;
      case "vite-error":
        listener({
          kind: "log-message",
          level: "error",
          timestamp: Date.now(),
          message: generateMessageFromViteError(message.payload.err),
        });
        break;
      case "vite-before-update":
        listener({
          kind: "before-vite-update",
          payload: message.payload,
        });
        break;
    }
  }

  private onBootstrapped() {
    if (this.lastRender) {
      this.render(this.lastRender.previewableId, this.lastRender.options).catch(
        // eslint-disable-next-line no-console
        console.error
      );
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

export type RendererLoader = (options: {
  wrapperModule: any;
  wrapperName?: string;
  previewableModule: any;
  previewableName: string;
  renderId: number;
  shouldAbortRender: () => boolean;
}) => Promise<{
  render: (getProps: GetPropsFn) => Promise<void>;
  // Note: we use `any` here because it depends on the framework.
  // This will be null if JSX isn't supported.
  jsxFactory: ((type: any, props: any, ...children: any[]) => any) | null;
}>;

export type JsxElementMounter = (element: JSX.Element) => Promise<void>;

export type GetPropsFn = (options: {
  presetGlobalProps: any;
  presetProps: any;
}) => Record<string, any>;

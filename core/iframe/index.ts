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
  private viteError: ErrorPayload | null = null;
  private renderingError: string | null = null;
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
    this.renderingError = null;
    this.viteError = null;
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
    this.renderingError = null;
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
      case "action":
      case "log-message":
        listener(data);
        break;
      case "renderer-updated":
        this.clearExpectRenderTimeout();
        listener({
          kind: "update",
          viteError: this.viteError,
          rendering: {
            kind: "success",
            variantKey: data.variantKey,
            variants: data.variants,
          },
        });
        break;
      case "rendering-error":
        this.renderingError = data.message;
        this.clearExpectRenderTimeout();
        listener({
          kind: "update",
          viteError: this.viteError,
          rendering: {
            kind: "error",
            error: this.renderingError,
          },
        });
        break;
      case "vite-logs-error":
        // We listen to HMR errors to learn about reload errors, for
        // which there is no Vite error. In other cases, we'd rather
        // prioritise Vite errors.
        if (!this.viteError) {
          this.viteError = {
            type: "error",
            err: {
              message: data.message,
              stack: "",
            },
          };
          listener({
            kind: "update",
            viteError: this.viteError,
            rendering: null,
          });
        }
        break;
      case "vite-error":
        this.viteError = data.payload;
        listener({
          kind: "update",
          viteError: this.viteError,
          rendering: null,
        });
        break;
      case "vite-before-update":
        this.viteError = null;
        listener({
          kind: "update",
          viteError: null,
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

export type PreviewEvent =
  | PreviewBootstrapped
  | PreviewUpdate
  | Action
  | LogMessage;

export type PreviewBootstrapped = {
  kind: "bootstrapped";
};

export type PreviewUpdate = {
  kind: "update";
  viteError: ErrorPayload | null;
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

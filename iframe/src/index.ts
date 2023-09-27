import type { UpdatePayload } from "vite/types/hmrPayload";

declare global {
  interface Window {
    // Exposed on the iframe.
    __PREVIEWJS_IFRAME__: {
      reportEvent(event: PreviewEvent): void;
      render?(options: RenderOptions): Promise<void>;
    };
    // Typically exposed on the iframe's parent to track its state.
    __PREVIEWJS_CONTROLLER__: {
      onPreviewEvent(event: PreviewEvent): void;
    };
  }
}

export interface RenderOptions {
  autogenCallbackPropsSource: string;
  propsAssignmentSource: string;
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
  private bootstrapStatus: "not-started" | "pending" | "success" | "failure" =
    "pending";
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
    if (
      previousRender?.previewableId !== previewableId ||
      this.bootstrapStatus === "failure"
    ) {
      this.resetIframe(previewableId);
      return;
    }
    const iframeWindow = this.options.getIframe()?.contentWindow;
    if (!iframeWindow || this.bootstrapStatus !== "success") {
      return;
    }
    if (!iframeWindow.__PREVIEWJS_IFRAME__.render) {
      iframeWindow.__PREVIEWJS_IFRAME__.reportEvent({
        kind: "error",
        source: "renderer",
        message:
          "Iframe was bootstrapped but not fully initialised.\n\nPlease report this at https://github.com/fwouts/previewjs.",
      });
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
    iframe.src = `/${id}/?t=${Date.now()}`;
    this.bootstrapStatus = "not-started";
  }

  onPreviewEvent(event: PreviewEvent) {
    const { listener } = this.options;

    if (this.bootstrapStatus === "not-started") {
      if (event.kind === "bootstrapping") {
        this.bootstrapStatus = "pending";
        listener(event);
      }
      // The only event we care about is bootstrapping.
      // Otherwise, it's a rogue event from a previous iframe.
      return;
    }

    switch (event.kind) {
      case "bootstrapped":
        this.bootstrapStatus = "success";
        if (this.lastRender) {
          this.render(
            this.lastRender.previewableId,
            this.lastRender.options
          ).catch(
            // eslint-disable-next-line no-console
            console.error
          );
        }
        break;
      case "vite-before-reload":
        if (this.lastRender) {
          this.resetIframe(this.lastRender.previewableId);
        } else {
          // TODO: Can this ever happen?
        }
        break;
      case "rendered":
        this.clearExpectRenderTimeout();
        break;
      case "error":
        this.clearExpectRenderTimeout();
        if (this.bootstrapStatus === "pending") {
          this.bootstrapStatus = "failure";
        }
        break;
    }
    listener(event);
  }

  private clearExpectRenderTimeout() {
    if (this.expectRenderTimeout) {
      clearTimeout(this.expectRenderTimeout);
      this.expectRenderTimeout = null;
    }
  }
}

export type PreviewEvent =
  | Bootstrapping
  | Bootstrapped
  | ViteBeforeUpdate
  | ViteBeforeReload
  | Rendered
  | Action
  | LogMessage
  | PreviewError;

export type Bootstrapping = {
  kind: "bootstrapping";
};

export type Bootstrapped = {
  kind: "bootstrapped";
};

export type ViteBeforeUpdate = {
  kind: "vite-before-update";
  payload: UpdatePayload;
};

export type ViteBeforeReload = {
  kind: "vite-before-reload";
};

export interface Rendered {
  kind: "rendered";
}

export interface Action {
  kind: "action";
  type: "fn" | "url";
  path: string;
}

export interface LogMessage {
  kind: "log-message";
  level: LogLevel;
  message: string;
}

export type PreviewError =
  | {
      kind: "error";
      source: "hmr";
      modulePath: string;
      message: string;
    }
  | {
      kind: "error";
      source: "vite";
      message: string;
    }
  | {
      kind: "error";
      source: "renderer";
      message: string;
    };

export type LogLevel = "log" | "info" | "warn" | "error";

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

export type GetPropsFn = (options: {
  presetGlobalProps: any;
  presetProps: any;
}) => Record<string, any>;

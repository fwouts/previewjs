import type { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import type { Action, LogMessage, Variant } from "./index";

export type PreviewToAppMessage =
  | Bootstrapped
  | BeforeRender
  | Action
  | LogMessage
  | RendererUpdated
  | RenderingError
  | ViteErrorMessage
  | ViteBeforeUpdateMessage;

export interface Bootstrapped {
  kind: "bootstrapped";
}

export interface BeforeRender {
  kind: "before-render";
}

export interface RendererUpdated {
  kind: "renderer-updated";
  filePath: string;
  componentName: string;
  variantKey: string;
  variants: Variant[];
}

export interface RenderingError {
  kind: "rendering-error";
  message: string;
}

export interface ViteErrorMessage {
  kind: "vite-error";
  payload: ErrorPayload;
}

export interface ViteBeforeUpdateMessage {
  kind: "vite-before-update";
  payload: UpdatePayload;
}

export type AppToPreviewMessage = ShowLoadingMessage | RenderMessage;

export interface ShowLoadingMessage {
  kind: "show-loading";
}

export interface RenderMessage {
  kind: "render";
  filePath: string;
  componentName: string;
  // Note: `null` means "first available preset variant, or fall back to custom".
  variantKey: string | null;
  defaultPropsSource: string;
  customVariantPropsSource: string;
}

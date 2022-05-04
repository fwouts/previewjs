import { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import { Action, LogMessage, Variant } from "../..";

export type PreviewToAppMessage =
  | Bootstrapped
  | BeforeRender
  | Action
  | LogMessage
  | RendererUpdated
  | RenderingError
  | HmrErrorMessage
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
  loadingError: string | null;
}

export interface RenderingError {
  kind: "rendering-error";
  message: string;
}

export interface HmrErrorMessage {
  kind: "vite-logs-error";
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

export function sendMessageFromPreview(message: PreviewToAppMessage) {
  sendParentMessage(message);
}

export function sendParentMessage(message: any) {
  window.parent.postMessage(message, "*");
}

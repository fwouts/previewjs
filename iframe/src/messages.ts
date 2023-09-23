import type { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import type { Action, LogMessage } from "./index";

export type PreviewToAppMessage =
  | Bootstrapped
  | BeforeRender
  | Action
  | LogMessage
  | RenderingSuccess
  | RenderingError
  | ViteErrorMessage
  | ViteBeforeUpdateMessage;

export interface Bootstrapped {
  kind: "bootstrapped";
}

export interface BeforeRender {
  kind: "before-render";
}

export interface RenderingSuccess {
  kind: "rendering-success";
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

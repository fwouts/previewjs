/// <reference types="vite/client" />
import type { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import { generateMessageFromError } from "./error-message";

const IGNORED_UPDATE_PATH = "/__previewjs_internal__/preview.js?";

export function setupViteHmrListener() {
  const hmr = import.meta.hot!;
  let error: ErrorPayload | null = null;
  let isFirstUpdate = true;
  hmr.on("vite:beforeFullReload", () => {
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "vite-before-reload",
    });
  });
  hmr.on("vite:error", (payload: ErrorPayload) => {
    error = payload;
    if (typeof payload.err?.message !== "string") {
      // This error doesn't match the expected payload.
      // For example, this can happen with invalid CSS.
      // Block this to prevent crashes down the track.
      return;
    }
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "error",
      source: "vite",
      message: generateMessageFromError(payload.err.message, payload.err.stack),
    });
  });
  hmr.on("vite:beforeUpdate", (payload: UpdatePayload) => {
    if (payload.updates.every((u) => u.path.startsWith(IGNORED_UPDATE_PATH))) {
      // Ignore.
      return;
    }
    // This is a copy of Vite logic that is disabled when the error overlay is off:
    // https://github.com/vitejs/vite/blob/f3d15f106f378c3850b62fbebd69fc8f7c7f944b/packages/vite/src/client/client.ts#L61
    if (error && isFirstUpdate) {
      window.location.reload();
    } else {
      error = null;
      isFirstUpdate = false;
    }
    if (window.__PREVIEWJS_IFRAME__.lastRenderFailed) {
      window.location.reload();
    } else {
      window.__PREVIEWJS_IFRAME__.reportEvent({
        kind: "vite-before-update",
        payload,
      });
    }
  });
  hmr.on("vite:afterUpdate", (payload: UpdatePayload) => {
    if (payload.updates.every((u) => u.path.startsWith(IGNORED_UPDATE_PATH))) {
      // Ignore.
      return;
    }
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "vite-after-update",
      payload,
    });
  });
  hmr.on("vite:invalidate", () => {
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "vite-invalidate",
    });
    window.__PREVIEWJS_IFRAME__.refresh({
      refetchPreviewableModule: true,
    });
  });
}

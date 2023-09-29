/// <reference types="vite/client" />
import type { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import { generateMessageFromError } from "./error-message";

export function setupViteHmrListener() {
  const maxWaitBeforeUpdatesDeclaredOverMillis = 300;
  let expectedUpdatePromise: Promise<void> = Promise.resolve();
  let onUpdate = () => {
    // Do nothing.
  };
  let callOnUpdateTimeout: any;
  window.__expectFutureRefresh__ = function () {
    expectedUpdatePromise = new Promise((resolve) => {
      onUpdate = resolve;
    });
  };
  window.__waitForExpectedRefresh__ = async function () {
    await expectedUpdatePromise;
  };

  function triggerOnUpdateSoon() {
    if (callOnUpdateTimeout) {
      clearTimeout(callOnUpdateTimeout);
    }
    callOnUpdateTimeout = setTimeout(() => {
      onUpdate();
      onUpdate = () => {
        // Do nothing.
      };
    }, maxWaitBeforeUpdatesDeclaredOverMillis);
  }

  const hmr = import.meta.hot!;
  let error: ErrorPayload | null = null;
  let isFirstUpdate = true;
  hmr.on("vite:beforeFullReload", () => {
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "vite-before-reload",
    });
  });
  hmr.on("vite:error", (payload: ErrorPayload) => {
    triggerOnUpdateSoon();
    error = payload;
    if (typeof payload.err?.message !== "string") {
      // This error doesn't match the expected payload.
      // For example, this can happen with invalid CSS with the
      // vite-plugin-vue2 plugin.
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
    // This is a copy of Vite logic that is disabled when the error overlay is off:
    // https://github.com/vitejs/vite/blob/f3d15f106f378c3850b62fbebd69fc8f7c7f944b/packages/vite/src/client/client.ts#L61
    if (error && isFirstUpdate) {
      window.location.reload();
    } else {
      error = null;
      isFirstUpdate = false;
    }
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "vite-before-update",
      payload,
    });
    triggerOnUpdateSoon();
  });
}

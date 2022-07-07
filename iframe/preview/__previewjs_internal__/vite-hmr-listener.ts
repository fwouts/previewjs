/// <reference types="vite/client" />
import type { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import { sendMessageFromPreview } from "./messages";
import { getState } from "./state";

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

const hmr = import.meta.hot!;
let error: ErrorPayload | null = null;
let isFirstUpdate = true;
hmr.on("vite:error", (payload: ErrorPayload) => {
  error = payload;
  if (typeof payload.err?.message !== "string") {
    // This error doesn't match the expected payload.
    // For example, this can happen with invalid CSS with the
    // vite-plugin-vue2 plugin.
    // Block this to prevent crashes down the track.
    return;
  }
  sendMessageFromPreview({
    kind: "vite-error",
    payload,
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
  const state = getState();
  payload.updates = payload.updates.filter((update) => {
    if (
      update.type === "js-update" &&
      state &&
      update.path.startsWith("/@component-loader.js")
    ) {
      const params = new URLSearchParams(update.path.split("?")[1] || "");
      const p = params.get("p");
      const c = params.get("c");
      if (p !== state.filePath || c !== state.componentName) {
        // Ignore old updates to /@component-loader.js, which are not needed
        // and may fail (e.g. if they import a file that no longer exists).
        return false;
      }
    }
    return true;
  });
  sendMessageFromPreview({
    kind: "vite-before-update",
    payload,
  });
  if (callOnUpdateTimeout) {
    clearTimeout(callOnUpdateTimeout);
  }
  callOnUpdateTimeout = setTimeout(() => {
    onUpdate();
    onUpdate = () => {
      // Do nothing.
    };
  }, maxWaitBeforeUpdatesDeclaredOverMillis);
});

import { ErrorPayload, UpdatePayload } from "vite/types/hmrPayload";
import { sendMessageFromPreview } from "./messages";
import { getState } from "./state";

// @ts-ignore
const hmr = import.meta.hot;
hmr.on("vite:error", (payload: ErrorPayload) => {
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
});

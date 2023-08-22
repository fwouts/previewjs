import type { PreviewToAppMessage } from "../../src/messages";

export function sendMessageFromPreview(message: PreviewToAppMessage) {
  (
    window.__PREVIEWJS_CONTROLLER__.onPreviewMessage ||
    window.parent.__PREVIEWJS_CONTROLLER__.onPreviewMessage
  )?.(message);
}

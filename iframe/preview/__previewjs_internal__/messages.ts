import type { PreviewToAppMessage } from "../../src/messages";

export function sendMessageFromPreview(message: PreviewToAppMessage) {
  (
    window.__PREVIEWJS__.onPreviewMessage ||
    window.parent.__PREVIEWJS__.onPreviewMessage
  )?.(message);
}

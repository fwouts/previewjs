import type { PreviewToAppMessage } from "../../src/messages";

export function sendMessageFromPreview(message: PreviewToAppMessage) {
  if (window.parent?.__PREVIEWJS_CONTROLLER__) {
    window.parent.__PREVIEWJS_CONTROLLER__.onPreviewMessage(message);
  } else {
    // @ts-ignore
    window.onPreviewMessage(message);
  }
}

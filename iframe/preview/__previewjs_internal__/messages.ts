import type { PreviewToAppMessage } from "../../src/messages";

declare global {
  interface Window {
    __previewjs_iframe_listener__?: (message: PreviewToAppMessage) => void;
  }
}

export function sendMessageFromPreview(message: PreviewToAppMessage) {
  if (window.__previewjs_iframe_listener__) {
    window.__previewjs_iframe_listener__(message);
  } else {
    sendParentMessage(message);
  }
}

export function sendParentMessage(message: any) {
  window.parent.postMessage(message, "*");
}

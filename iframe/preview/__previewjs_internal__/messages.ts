import type { PreviewToAppMessage } from "../../src/messages";

export function sendMessageFromPreview(message: PreviewToAppMessage) {
  sendParentMessage(message);
}

export function sendParentMessage(message: any) {
  window.parent.postMessage(message, "*");
}

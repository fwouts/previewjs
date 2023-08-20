import type { PreviewEvent } from "@previewjs/iframe";
import { createController } from "@previewjs/iframe";

declare global {
  interface Window {
    onIframeEvent?(event: PreviewEvent): void;
  }
}

const controller = createController({
  getIframe: () => document.getElementById("iframe") as HTMLIFrameElement,
  listener: (event) => {
    if (window.onIframeEvent) {
      window.onIframeEvent(event);
    }
  },
});

window.onload = () => {
  controller.start();
};

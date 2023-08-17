import type { LoadPreviewOptions, PreviewEvent } from "@previewjs/iframe";
import { createController } from "@previewjs/iframe";

declare global {
  interface Window {
    loadIframePreview(options: LoadPreviewOptions): void;
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
  window.loadIframePreview = (options: LoadPreviewOptions) => {
    controller.load(options);
  };
};

import type { PreviewEvent, RenderOptions } from "@previewjs/iframe";
import { createController } from "@previewjs/iframe";

declare global {
  interface Window {
    loadIframePreview(options: RenderOptions): void;
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
  window.loadIframePreview = (options: RenderOptions) => {
    controller.render(options);
  };
};

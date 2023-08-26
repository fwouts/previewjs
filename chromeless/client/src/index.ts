import type { PreviewEvent, RenderOptions } from "@previewjs/iframe";
import { createController } from "@previewjs/iframe";

declare global {
  interface Window {
    loadIframePreview(previewableId: string, options: RenderOptions): void;
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
  window.loadIframePreview = (
    previewableId: string,
    options: RenderOptions
  ) => {
    controller.render(previewableId, options);
  };
};

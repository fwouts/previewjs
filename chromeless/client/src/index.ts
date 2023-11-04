import type { PreviewIframeState, RenderOptions } from "@previewjs/iframe";
import { createController } from "@previewjs/iframe";

declare global {
  interface Window {
    loadIframePreview(previewableId: string, options: RenderOptions): void;
    onIframeStateUpdate?(state: PreviewIframeState): void;
  }
}

const controller = createController({
  getIframe: () => document.getElementById("iframe") as HTMLIFrameElement,
  onStateUpdate: (state) => {
    window.onIframeStateUpdate?.(state);
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

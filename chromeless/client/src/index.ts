import type { PreviewEvent } from "@previewjs/iframe";
import { createController } from "@previewjs/iframe";

export type Component = {
  componentId: string;
  autogenCallbackPropsSource: string;
  propsAssignmentSource: string;
};

declare global {
  interface Window {
    renderComponent(component: Component): void;
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
  window.renderComponent = (component: Component) => {
    controller.loadComponent(component);
  };
};

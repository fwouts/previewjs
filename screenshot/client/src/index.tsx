import { createController, PreviewEvent } from "@previewjs/iframe";

type Component = {
  filePath: string;
  componentName: string;
  customVariantPropsSource: string;
};

declare global {
  interface Window {
    renderComponent(component: Component): void;
    onIframeEvent(event: PreviewEvent): void;
  }
}

window.renderComponent = (component: Component) => {
  const iframe = document.getElementById("iframe") as HTMLIFrameElement;
  const controller = createController({
    getIframe: () => iframe,
    listener: window.onIframeEvent,
  });
  controller.start();
  controller.loadComponent({
    ...component,
    defaultPropsSource: "{}",
    variantKey: null,
  });
};

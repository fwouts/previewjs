import { createController } from "@previewjs/iframe";

type Component = {
  filePath: string;
  componentName: string;
};

declare global {
  interface Window {
    render(components: Component[]): void;
  }
}

window.render = (components: Component[]) => {
  const iframe = document.getElementById("iframe") as HTMLIFrameElement;
  let currentIndex = -1;
  const controller = createController({
    getIframe: () => iframe,
    listener: (event) => {
      if (event.kind === "bootstrapped" || event.kind === "rendering-done") {
        // nextScreenshot();
        setTimeout(() => nextScreenshot(), 1000);
      }
    },
  });
  controller.start();

  function nextScreenshot() {
    setTimeout(() => {
      console.log(iframe.contentDocument?.body.innerHTML);
      const component = components[++currentIndex];
      if (!component) {
        console.log("Done!");
        return;
      }
      controller.loadComponent({
        ...component,
        customVariantPropsSource: "properties = {}",
        defaultPropsSource: "{}",
        variantKey: null,
      });
    }, 0);
  }
};

/**
 * TODO:
 * - set up test runner with snapshot of controller listener events
 * - convert existing tests to it?
 */

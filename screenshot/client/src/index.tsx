import { createController } from "@previewjs/iframe";

// TODO: Automate this.

type Component = {
  filePath: string;
  componentName: string;
};

const components: Component[] = [
  {
    filePath: "design/RestaurantHeader/RestaurantHeader.tsx",
    componentName: "RestaurantHeader",
  },
  {
    filePath: "design/RestaurantMenuItem/RestaurantMenuItem.tsx",
    componentName: "RestaurantMenuItem",
  },
  {
    filePath: "design/Counter/Counter.tsx",
    componentName: "Counter",
  },
  {
    filePath: "design/NoMatch/NoMatch.tsx",
    componentName: "NoMatch",
  },
];

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

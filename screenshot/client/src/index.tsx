import { createController } from "@previewjs/core/controller";

// TODO: Automate this.

type Component = {
  filePath: string;
  componentName: string;
};

const components: Component[] = [
  {
    filePath: "design/HeroHeader/HeroHeader.tsx",
    componentName: "HeroHeader",
  },
  {
    filePath: "design/MenuItemPicker/MenuItemPicker.tsx",
    componentName: "MenuItemPicker",
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
    if (
      event.kind === "bootstrapped" ||
      (event.kind === "update" && event.rendering?.kind === "success")
    ) {
      nextScreenshot();
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
      customVariantPropsSource: "{}",
      defaultPropsSource: "{}",
      variantKey: null,
    });
  }, 0);
}

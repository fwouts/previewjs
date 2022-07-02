import type { RendererLoader } from "@previewjs/iframe";
import { App, createApp, FunctionalComponent } from "vue";

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentFilePath,
  componentModule,
  componentName,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  let Component: any;
  if (componentFilePath.endsWith(".vue")) {
    Component = componentModule.default;
    if (!Component) {
      throw new Error(
        `No default component could be found in ${componentFilePath}`
      );
    }
  } else {
    Component = componentModule[`__previewjs__${componentName}`];
    if (!Component) {
      throw new Error(`No component named '${componentName}'`);
    }
  }
  let storyDecorators = [];
  if (typeof Component === "function") {
    const maybeStory = Component;
    const maybeStoryArgs = {
      ...componentModule.default?.args,
      ...maybeStory.args,
    };
    const maybeStoryComponent = maybeStory(maybeStoryArgs);
    if (maybeStoryComponent?.components || maybeStoryComponent?.template) {
      // This looks a lot like a Storybook story. It must be one.
      Component = maybeStoryComponent;
      storyDecorators = maybeStory.decorators || [];
    }
  }
  const decorators = [
    ...storyDecorators,
    ...(componentModule.default?.decorators || []),
  ];
  const Decorated = decorators.reduce((component, decorator) => {
    const decorated = decorator();
    return {
      ...decorated,
      components: { ...decorated.components, story: component },
    };
  }, Component);
  const previews =
    typeof Component.previews === "function"
      ? Component.previews()
      : Component.previews || {};
  const variants = Object.entries(previews).map(([key, props]) => {
    return {
      key,
      label: key,
      props,
    };
  });
  return {
    variants,
    render: async (props) => {
      await render(
        (props) =>
          Wrapper
            ? // @ts-ignore
              h(Wrapper, null, () => h(Decorated, props))
            : // @ts-ignore
              h(Decorated, props),
        props
      );
    },
  };
};

let app: App | null = null;
export async function render<P extends Record<string, unknown>>(
  Renderer: FunctionalComponent<P>,
  props: P
) {
  if (app) {
    app.unmount();
    app = null;
  }
  if (!Renderer) {
    return;
  }
  app = createApp(Renderer, props || {});
  app.mount("#root");
}

export async function detach() {
  render(null, {});
}

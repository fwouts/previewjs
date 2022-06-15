import type { RendererLoader } from "@previewjs/core/controller";
import Vue from "vue";

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
  let defaultProps = {};
  let storyDecorators = [];
  storybookCheck: if (typeof Component === "function") {
    const maybeStory = Component;
    const maybeStoryArgs = maybeStory.args || {};
    let maybeStoryComponent;
    try {
      maybeStoryComponent = Component(maybeStoryArgs, {
        argTypes: maybeStoryArgs,
      });
    } catch (e) {
      // It must not be a story component.
      break storybookCheck;
    }
    if (
      maybeStoryComponent?.components ||
      maybeStoryComponent?.template ||
      maybeStoryComponent?.render
    ) {
      // This looks a lot like a Storybook story. It must be one.
      Component = maybeStoryComponent;
      defaultProps = maybeStoryArgs;
      storyDecorators = maybeStory.decorators || [];
      if (!Component.template && !Component.render) {
        Component = Object.values(Component.components)[0];
        if (!Component) {
          throw new Error(
            "Encountered a story with no template, render or components"
          );
        }
      }
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
      await render((h, props) => {
        const Wrapped = h(Decorated, {
          props: {
            ...defaultProps,
            ...props,
          },
        });
        return Wrapper ? h(Wrapper, {}, [Wrapped]) : Wrapped;
      }, props);
    },
  };
};

const root = document.getElementById("root");
let app: Vue | null = null;

// TODO: Type Renderer properly.
async function render<P>(Renderer: any, props: P) {
  if (app) {
    app.$destroy();
    app = null;
  }
  if (!Renderer) {
    return;
  }
  if (Renderer.functional) {
    Renderer = Renderer.render;
  }
  app = new Vue({
    render: (h) => Renderer(h, props),
  }).$mount();
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }
  root.appendChild(app.$el);
}

export async function detach() {
  render(null, {});
}

import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import { App, createApp } from "vue";

let app: App | null = null;

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentFilePath,
  componentModule,
  componentName,
  shouldAbortRender,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  let ComponentOrStory: any;
  if (componentFilePath.endsWith(".vue")) {
    ComponentOrStory = componentModule.default;
    if (!ComponentOrStory) {
      throw new Error(
        `No default component could be found in ${componentFilePath}`
      );
    }
  } else {
    ComponentOrStory = componentModule[`__previewjs__${componentName}`];
    if (!ComponentOrStory) {
      throw new Error(`No component named '${componentName}'`);
    }
  }
  let storyDecorators = ComponentOrStory.decorators || [];
  let RenderComponent = ComponentOrStory;
  if (ComponentOrStory.render) {
    // Vue component. Nothing to do.
  } else {
    // JSX or Storybook story, either CSF2 or CSF3.
    if (typeof ComponentOrStory === "function") {
      RenderComponent = (props) => {
        const storyReturnValue = ComponentOrStory(props);
        if (storyReturnValue.template) {
          // CSF2 story.
          // @ts-ignore
          return h(storyReturnValue, props);
        } else {
          // JSX
          return storyReturnValue;
        }
      };
    } else {
      // CSF3 story.
      const csf3Story = ComponentOrStory;
      RenderComponent =
        csf3Story.component || componentModule.default?.component;
      if (!RenderComponent) {
        throw new Error("Encountered a story with no component");
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
  }, RenderComponent);
  return {
    render: async (getProps: GetPropsFn) => {
      if (shouldAbortRender()) {
        return;
      }
      if (app) {
        app.unmount();
        app = null;
      }
      const props = getProps({
        presetGlobalProps: componentModule.default?.args || {},
        presetProps: ComponentOrStory.args || {},
      });
      app = createApp(() => {
        // @ts-ignore
        const decoratedNode = h(Decorated, props);
        return Wrapper
          ? // @ts-ignore
            h(Wrapper, null, () => decoratedNode)
          : decoratedNode;
      }, {});
      app.mount("#root");
    },
  };
};

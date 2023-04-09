import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import Vue from "vue";

const root = document.getElementById("root")!;
let app: Vue | null = null;

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentId,
  shouldAbortRender,
}) => {
  const componentName = componentId.substring(componentId.indexOf(":") + 1);
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  let ComponentOrStory: any;
  if (componentId.includes(".vue:")) {
    ComponentOrStory = componentModule.default;
    if (!ComponentOrStory) {
      throw new Error(`No default component could be found for ${componentId}`);
    }
  } else {
    ComponentOrStory = componentModule[`__previewjs__${componentName}`];
    if (!ComponentOrStory) {
      throw new Error(`No component named '${componentName}'`);
    }
  }
  let storyDecorators = ComponentOrStory.decorators || [];
  let RenderComponent = ComponentOrStory;
  if (ComponentOrStory.render || ComponentOrStory.name === "VueComponent") {
    // Vue or JSX component. Nothing to do.
  } else {
    // Storybook story, either CSF2 or CSF3.
    if (typeof ComponentOrStory === "function") {
      // CSF2 story.
      RenderComponent = {
        functional: true,
        render: (h: any, data: any) => {
          const storyReturnValue = ComponentOrStory(data.props, {
            argTypes: data.props,
          });
          if (storyReturnValue.template) {
            return h(storyReturnValue, data);
          }
          const component =
            Object.values(storyReturnValue.components || {})[0] ||
            componentModule.default?.component;
          if (!component) {
            throw new Error(
              "Encountered a story with no template or components"
            );
          }
          return h(component, data);
        },
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
        app.$destroy();
        app = null;
      }
      app = new Vue({
        render: (h) =>
          h(
            {
              functional: true,
              render: (h: any, data: any) => {
                const Wrapped = h(Decorated, data);
                return Wrapper ? h(Wrapper, {}, [Wrapped]) : Wrapped;
              },
            },
            {
              props: getProps({
                presetGlobalProps: componentModule.default?.args || {},
                presetProps: ComponentOrStory.args || {},
              }),
            }
          ),
      }).$mount();
      while (root.firstChild) {
        root.removeChild(root.firstChild);
      }
      root.appendChild(app.$el);
    },
    // While Vue 2 exposes h(), it can only be used when a component is already being rendered.
    // This makes the approach of invoking jsxFactory prior to rendering the component unfeasible.
    jsxFactory: null,
  };
};

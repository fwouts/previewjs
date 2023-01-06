import type { RendererLoader } from "@previewjs/iframe";
import Vue from "vue";

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
  let autogenCallbackProps = {
    ...componentModule.default?.args,
    ...ComponentOrStory.args,
  };
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
        render: (h, data) => {
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
    render: async (props) => {
      if (shouldAbortRender()) {
        return;
      }
      await render(
        {
          functional: true,
          render: (h, data) => {
            const Wrapped = h(Decorated, data);
            return Wrapper ? h(Wrapper, {}, [Wrapped]) : Wrapped;
          },
        },
        {
          props: {
            ...autogenCallbackProps,
            ...props,
          },
        }
      );
    },
  };
};

const root = document.getElementById("root");
let app: Vue | null = null;

// TODO: Type Renderer properly.
async function render<P>(Renderer: any, data: P) {
  if (app) {
    app.$destroy();
    app = null;
  }
  if (!Renderer) {
    return;
  }
  app = new Vue({
    render: (h) => h(Renderer, data),
  }).$mount();
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }
  root.appendChild(app.$el);
}

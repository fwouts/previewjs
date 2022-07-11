import type { RendererLoader } from "@previewjs/iframe";
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
  let defaultProps = {
    ...componentModule.default?.args,
    ...ComponentOrStory.args,
  };
  let storyDecorators = ComponentOrStory.decorators || [];
  let RenderComponent = ComponentOrStory;
  if (ComponentOrStory.functional) {
    // JSX component. Nothing to do.
  } else if (!ComponentOrStory._isVue) {
    // Storybook story, either CSF2 or CSF3.
    if (typeof ComponentOrStory === "function") {
      // CSF2 story.
      const csf2StoryComponent = ComponentOrStory(defaultProps, {
        argTypes: defaultProps,
      });
      if (!csf2StoryComponent) {
        throw new Error("Encountered invalid CSF2 story");
      }
      // This looks a lot like a CSF2 story. It must be one.
      storyDecorators.push(...(csf2StoryComponent.decorators || []));
      if (csf2StoryComponent.template) {
        RenderComponent = csf2StoryComponent;
      } else {
        RenderComponent = Object.values(csf2StoryComponent.components || {})[0];
        if (!RenderComponent) {
          throw new Error("Encountered a story with no template or components");
        }
      }
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
  const previews =
    typeof RenderComponent.previews === "function"
      ? RenderComponent.previews()
      : RenderComponent.previews || {};
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

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
  let defaultProps = {
    ...componentModule.default?.args,
    ...ComponentOrStory.args,
  };
  let storyDecorators = ComponentOrStory.decorators || [];
  let RenderComponent = ComponentOrStory;
  if (ComponentOrStory.render) {
    // Vue or JSX component. Nothing to do.
  } else {
    // Storybook story, either CSF2 or CSF3.
    storybookCheck: if (typeof ComponentOrStory === "function") {
      // CSF2 story.
      let maybeCsf2StoryComponent;
      try {
        maybeCsf2StoryComponent = ComponentOrStory(defaultProps, {
          argTypes: defaultProps,
        });
      } catch (e) {
        // Not a CSF2 story. Nothing to do.
        break storybookCheck;
      }
      if (
        !maybeCsf2StoryComponent ||
        (!maybeCsf2StoryComponent?.components &&
          !maybeCsf2StoryComponent?.template)
      ) {
        // Vue or JSX component. Nothing to do.
      } else {
        // This looks a lot like a CSF2 story. It must be one.
        const csf2StoryComponent = maybeCsf2StoryComponent;
        storyDecorators.push(...(csf2StoryComponent.decorators || []));
        if (csf2StoryComponent.template) {
          RenderComponent = csf2StoryComponent;
        } else {
          RenderComponent = Object.values(
            csf2StoryComponent.components || {}
          )[0];
          if (!RenderComponent) {
            throw new Error(
              "Encountered a story with no template or components"
            );
          }
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
      if (shouldAbortRender()) {
        return;
      }
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

import type { RendererLoader } from "@previewjs/iframe";
import { App, createApp, FunctionalComponent } from "vue";

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
    storybookCheck: if (typeof ComponentOrStory === "function") {
      // JSX or CSF2.
      let maybeCsf2StoryComponent;
      try {
        maybeCsf2StoryComponent = ComponentOrStory(defaultProps);
      } catch (e) {
        // Vue or JSX component. Nothing to do.
        break storybookCheck;
      }
      if (
        !maybeCsf2StoryComponent ||
        (!maybeCsf2StoryComponent?.components &&
          !maybeCsf2StoryComponent?.template)
      ) {
        // Vue or JSX component. Nothing to do.
      } else {
        // CSF2 story.
        const csf2StoryComponent = ComponentOrStory(defaultProps);
        if (!csf2StoryComponent) {
          throw new Error("Encountered invalid CSF2 story");
        }
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
      await render(
        (props) =>
          Wrapper
            ? // @ts-ignore
              h(Wrapper, null, () => h(Decorated, props))
            : // @ts-ignore
              h(Decorated, props),
        {
          ...defaultProps,
          ...props,
        }
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

import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import type { App } from "vue";
import { createApp } from "vue";

const root = document.getElementById("root")!;
let app: App | null = null;

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  previewableModule,
  id,
  shouldAbortRender,
}) => {
  const previewableName = id.substring(id.indexOf(":") + 1);
  const isStoryModule = !!previewableModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  let Previewable: any;
  if (id.includes(".vue:")) {
    Previewable = previewableModule.default;
    if (!Previewable) {
      throw new Error(`No default component could be found for ${id}`);
    }
  } else {
    Previewable = previewableModule[`__previewjs__${previewableName}`];
    if (!Previewable) {
      throw new Error(`No component or story named '${previewableName}'`);
    }
  }
  let storyDecorators = Previewable.decorators || [];
  let RenderComponent = Previewable;
  if (Previewable.render && !isStoryModule) {
    // Vue component. Nothing to do.
  } else {
    // JSX or Storybook story, either CSF2 or CSF3.
    if (typeof Previewable === "function") {
      RenderComponent = (props: any) => {
        const storyReturnValue = Previewable(props);
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
      const csf3Story = Previewable;
      RenderComponent =
        csf3Story.component || previewableModule.default?.component;
      if (!RenderComponent) {
        throw new Error("Encountered a story with no component");
      }
    }
  }
  const decorators = [
    ...storyDecorators,
    ...(previewableModule.default?.decorators || []),
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
        presetGlobalProps: previewableModule.default?.args || {},
        presetProps: Previewable.args || {},
      });
      app = createApp(() => {
        // @ts-ignore
        const decoratedNode = slotTransformingH(Decorated, props);
        return Wrapper
          ? // @ts-ignore
            h(Wrapper, null, () => decoratedNode)
          : decoratedNode;
      }, {});
      app.mount(root);
      if (Previewable.play) {
        try {
          await Previewable.play({ canvasElement: root });
        } catch (e: any) {
          // For some reason, Storybook expects to throw exceptions that should be ignored.
          if (!e.message?.startsWith("ignoredException")) {
            throw e;
          }
        }
      }
    },
    // @ts-ignore
    jsxFactory: slotTransformingH,
  };
};

function slotTransformingH(component: any, props: any, children: any) {
  props ||= {};
  // @ts-ignore
  return h(
    component,
    Object.fromEntries(
      Object.entries(props).filter(
        ([propName]) => !propName.startsWith("slot:")
      )
    ),
    children !== undefined
      ? children
      : Object.fromEntries(
          Object.entries(props)
            .filter(([propName]) => propName.startsWith("slot:"))
            .map(([propName, propValue]) => [
              propName.substring(5),
              () => propValue,
            ])
        )
  );
}

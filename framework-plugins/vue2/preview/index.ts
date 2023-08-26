import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import Vue from "vue";

const root = document.getElementById("root")!;
let app: Vue | null = null;

export const loadRenderer: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  previewableModule,
  previewableName,
  shouldAbortRender,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  let Previewable: any;
  if (
    (
      previewableModule.default?.__file ||
      previewableModule.default?.options?.__file
    )?.endsWith(".vue")
  ) {
    Previewable = previewableModule.default;
    if (!Previewable) {
      throw new Error(`No default component could be found`);
    }
  } else {
    Previewable = previewableModule[`__previewjs__${previewableName}`];
    if (!Previewable) {
      throw new Error(`No component or story named '${previewableName}'`);
    }
  }
  let storyDecorators = Previewable.decorators || [];
  let RenderComponent = Previewable;
  if (Previewable.render || Previewable.name === "VueComponent") {
    // Vue or JSX component. Nothing to do.
  } else {
    // Storybook story, either CSF2 or CSF3.
    if (typeof Previewable === "function") {
      // CSF2 story.
      RenderComponent = {
        functional: true,
        render: (h: any, data: any) => {
          const storyReturnValue = Previewable(data.props, {
            argTypes: data.props,
          });
          if (storyReturnValue.template) {
            return h(storyReturnValue, data);
          }
          const component =
            Object.values(storyReturnValue.components || {})[0] ||
            previewableModule.default?.component;
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
        app.$destroy();
        app = null;
      }
      const props = getProps({
        presetGlobalProps: previewableModule.default?.args || {},
        presetProps: Previewable.args || {},
      });
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
              props: Object.fromEntries(
                Object.entries(props).filter(
                  ([propName]) => !propName.startsWith("slot:")
                )
              ),
              scopedSlots: Object.fromEntries(
                Object.entries(props)
                  .filter(([propName]) => propName.startsWith("slot:"))
                  .map(([propName, propValue]) => [
                    propName.substring(5),
                    () => h("span", propValue),
                  ])
              ),
            }
          ),
      }).$mount();
      while (root.firstChild) {
        root.removeChild(root.firstChild);
      }
      root.appendChild(app.$el);
      if (Previewable.play) {
        await Previewable.play({ canvasElement: root });
      }
    },
    // While Vue 2 exposes h(), it can only be used when a component is already being rendered.
    // This makes the approach of invoking jsxFactory prior to rendering the component unfeasible.
    jsxFactory: null,
  };
};

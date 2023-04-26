import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import { SvelteComponent } from "svelte";
import * as si from "svelte/internal";

const root = document.getElementById("root")!;
let currentElement: any = null;

type Component = any;

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentId,
  shouldAbortRender,
}) => {
  const componentName = componentId.substring(componentId.indexOf(":") + 1);
  const isStoryModule = !!componentModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  const ComponentOrStory =
    componentModule[isStoryModule ? componentName : "default"];
  if (!ComponentOrStory) {
    throw new Error(`No component named '${componentName}'`);
  }
  const RenderComponent = isStoryModule
    ? ComponentOrStory.component || componentModule.default?.component
    : ComponentOrStory;
  const decorators = [
    ...(ComponentOrStory.decorators || []),
    ...(componentModule.default?.decorators || []),
  ];
  return {
    render: async (getProps: GetPropsFn) => {
      if (shouldAbortRender()) {
        return;
      }
      if (currentElement) {
        currentElement.$destroy();
        currentElement = null;
      }
      root.innerHTML = "";
      const props = getProps({
        presetGlobalProps: componentModule.default?.args || {},
        presetProps: ComponentOrStory.args || {},
      });
      const [Decorated, decoratedProps] = decorate(
        RenderComponent,
        props,
        decorators.reverse()
      );
      currentElement = Wrapper
        ? new Wrapper({
            target: root,
            props: {
              $$slots: createSlots({
                default: [Decorated, decoratedProps],
              }),
              $$scope: {},
            },
          })
        : new Decorated({
            target: root,
            props: decoratedProps,
          });
      if (ComponentOrStory.play) {
        try {
          await ComponentOrStory.play({ canvasElement: root });
        } catch (e: any) {
          // For some reason, Storybook expects to throw exceptions that should be ignored.
          if (!e.message?.startsWith("ignoredException")) {
            throw e;
          }
        }
      }
    },
    jsxFactory: null,
  };
};

// https://storybook.js.org/docs/svelte/writing-stories/decorators
function decorate(
  Component: Component,
  props: any,
  decorators: Array<() => Component>
): [Component, any] {
  if (decorators.length === 0) {
    return [Component, props];
  }
  const [rootDecoratorFn, ...remainingDecorators] = decorators;
  const RootDecorator = rootDecoratorFn!();
  return [
    RootDecorator,
    {
      $$slots: createSlots({
        default: decorate(Component, props, remainingDecorators),
      }),
      $$scope: {},
    },
  ];
}

// Source: https://github.com/sveltejs/svelte/issues/2588#issuecomment-828578980
const createSlots = (slots: Record<string, any>) => {
  const svelteSlots: Record<string, any> = {};

  for (const slotName in slots) {
    svelteSlots[slotName] = [createSlotFn(slots[slotName])];
  }

  function createSlotFn([ele, props = {}]: any) {
    if (si.is_function(ele) && ele.prototype instanceof SvelteComponent) {
      let component: any;
      return function () {
        return {
          c: si.noop,
          m(target: any, anchor: any) {
            component = new ele({ target, props });
            si.mount_component(component, target, anchor, null);
          },
          d(detaching: any) {
            si.destroy_component(component, detaching);
          },
          l: si.noop,
        };
      };
    } else {
      return function () {
        return {
          c: si.noop,
          m: function mount(target: any, anchor: any) {
            si.insert(target, ele, anchor);
          },
          d: function destroy(detaching: any) {
            if (detaching) {
              si.detach(ele);
            }
          },
          l: si.noop,
        };
      };
    }
  }
  return svelteSlots;
};

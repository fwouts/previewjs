import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import { SvelteComponent } from "svelte";
// @ts-ignore
import * as si from "svelte/internal";

const root = document.getElementById("root")!;
let currentElement: any = null;

type Component = any;

export const loadRenderer: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  previewableModule,
  previewableName,
  shouldAbortRender,
}) => {
  const isStoryModule = !!previewableModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  const Previewable =
    previewableModule[isStoryModule ? previewableName : "default"];
  if (!Previewable) {
    throw new Error(`No component or story named '${previewableName}'`);
  }
  const RenderComponent = isStoryModule
    ? Previewable.component || previewableModule.default?.component
    : Previewable;
  const decorators = [
    ...(Previewable.decorators || []),
    ...(previewableModule.default?.decorators || []),
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
      const props = wrapSlotProps(
        getProps({
          presetGlobalProps: previewableModule.default?.args || {},
          presetProps: Previewable.args || {},
        })
      );
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
    jsxFactory: null,
  };
};

function wrapSlotProps(props: Record<string, any>) {
  const result: Record<string, any> = {};
  const slots: Record<string, any> = {};
  for (const [key, value] of Object.entries(props)) {
    if (key.startsWith("slot:")) {
      const element = document.createElement("span");
      element.innerText = value;
      slots[key.substring(5)] = [element];
    } else {
      result[key] = value;
    }
  }
  if (Object.keys(slots).length > 0) {
    result.$$slots = createSlots(slots);
    result.$$scope = {};
  }
  return result;
}

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

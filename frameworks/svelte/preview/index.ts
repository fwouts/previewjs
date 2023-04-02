import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import { SvelteComponent } from "svelte";
import * as si from "svelte/internal";

const root = document.getElementById("root")!;
let currentElement: any = null;

// TODO: Support Storybook.
export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  shouldAbortRender,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  const Component = componentModule.default;
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
        // TODO: Pass Storybook args.
        presetGlobalProps: {},
        presetProps: {},
      });
      currentElement = Wrapper
        ? new Wrapper({
            target: root,
            props: {
              $$slots: createSlots({
                default: [Component, props],
              }),
              $$scope: {},
            },
          })
        : new Component({
            target: root,
            props,
          });
    },
    jsxFactory: null,
  };
};

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

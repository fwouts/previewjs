import type { RendererLoader } from "@previewjs/iframe";
import { SvelteComponent } from "svelte";
import * as si from "svelte/internal";

const root = document.getElementById("root")!;
let currentElement = null;

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
    variants: [],
    render: async (props) => {
      if (shouldAbortRender()) {
        return;
      }
      detach();
      (currentElement = Wrapper
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
          })),
        {
          // ...defaultProps,
          ...props,
        };
    },
  };
};

export async function detach() {
  if (currentElement) {
    currentElement.$destroy();
    currentElement = null;
  }
  root.innerHTML = "";
}

// Source: https://github.com/sveltejs/svelte/issues/2588#issuecomment-828578980
const createSlots = (slots) => {
  const svelteSlots = {};

  for (const slotName in slots) {
    svelteSlots[slotName] = [createSlotFn(slots[slotName])];
  }

  function createSlotFn([ele, props = {}]) {
    if (si.is_function(ele) && ele.prototype instanceof SvelteComponent) {
      let component;
      return function () {
        return {
          c: si.noop,
          m(target, anchor) {
            component = new ele({ target, props });
            si.mount_component(component, target, anchor, null);
          },
          d(detaching) {
            si.destroy_component(component, detaching);
          },
          l: si.noop,
        };
      };
    } else {
      return function () {
        return {
          c: si.noop,
          m: function mount(target, anchor) {
            console.error("FOO", target, ele);
            si.insert(target, ele, anchor);
          },
          d: function destroy(detaching) {
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

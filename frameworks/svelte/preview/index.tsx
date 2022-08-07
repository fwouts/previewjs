import type { RendererLoader } from "@previewjs/iframe";

// TODO: Support Wrapper.
// TODO: Support Storybook.
export const load: RendererLoader = async ({ componentModule }) => {
  const Component = componentModule.default;
  return {
    variants: [],
    render: async (props) => {
      await render(
        (props) => ({
          Component,
          props,
        }),
        {
          // ...defaultProps,
          ...props,
        }
      );
    },
  };
};

const root = document.getElementById("root")!;

// TODO: add type for Renderer.
export function render(
  Renderer: (props: any) => { Component: any; props: any },
  props: any
) {
  try {
    root.innerHTML = "";
    const { Component, props: topLevelProps } = Renderer(props);
    new Component({
      target: root,
      props: topLevelProps,
    });
  } catch (e) {
    console.error(e);
  }
}

export async function detach() {
  render(null, {});
}

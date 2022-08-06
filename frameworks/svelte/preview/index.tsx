import type { RendererLoader } from "@previewjs/iframe";
// @ts-ignore

// TODO: Support Storybook.
export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "default"]) || null;
  const Component = componentModule.default;
  return {
    variants: [],
    render: async (props) => {
      await render(
        (props) =>
          Wrapper
            ? // @ts-ignore
              h(Wrapper, null, () => h(Component, props))
            : // @ts-ignore
              h(Component, props),
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
  root.innerHTML = "";
  const { Component, props: topLevelProps } = Renderer(props);
  new Component({
    target: root,
    props: topLevelProps,
  });
}

export async function detach() {
  render(null, {});
}

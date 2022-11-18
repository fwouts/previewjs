import type { RendererLoader } from "@previewjs/iframe";

import { render } from "@builder.io/qwik";
import { QWIK_LOADER } from "@builder.io/qwik/loader/index";
eval(QWIK_LOADER);

const root = document.getElementById("root")!;

// TODO: Support Storybook.
export const load: RendererLoader = async ({
  // wrapperModule,
  // wrapperName,
  componentModule,
  componentName,
  shouldAbortRender,
}) => {
  // TODO: Support Wrapper?
  const Component = componentModule[componentName];
  return {
    render: async (props) => {
      if (shouldAbortRender()) {
        return;
      }
      // TODO: Detach previous element?
      root.innerHTML = "";
      render(root, Component(props));
    },
  };
};

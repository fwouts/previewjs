import type { RendererLoader } from "@previewjs/iframe";

import { render } from "@builder.io/qwik";
import { QWIK_LOADER } from "@builder.io/qwik/loader";
eval(QWIK_LOADER);

const root = document.getElementById("root")!;

// TODO: Support Storybook.
export const load: RendererLoader = async ({
  // wrapperModule,
  // wrapperName,
  componentModule,
  componentId,
  shouldAbortRender,
}) => {
  const componentName = componentId.substring(componentId.indexOf(":") + 1);
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
    jsxFactory: null,
  };
};

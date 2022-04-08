import type { RendererLoader } from "@previewjs/core/controller";
import React from "react";

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    React.Fragment;
  const Component =
    componentModule[
      componentName === "default" ? "default" : `__previewjs__${componentName}`
    ];
  if (!Component) {
    throw new Error(`No component named '${componentName}'`);
  }
  const decorators = [
    ...(Component.decorators || []),
    ...(componentModule.default?.decorators || []),
  ];
  const variants = (Component.__previewjs_variants || []).map((variant) => {
    return {
      key: variant.key,
      label: variant.label,
      props: variant.props,
    };
  });
  const Renderer = (props) => {
    return (
      <Wrapper>
        {decorators.reduce(
          (component, decorator) => () => decorator(component),
          () => <Component {...Component.args} {...props} />
        )()}
      </Wrapper>
    );
  };
  return {
    variants,
    render: async (props) => {
      const { render } = await import("./render-16");
      await render(Renderer, props);
    },
  };
};

export async function detach() {
  const { render } = await import("./render-16");
  render(null, {});
}

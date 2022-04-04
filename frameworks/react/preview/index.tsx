import React from "react";
// @ts-ignore Vite is fine with this
import { version } from "react/package.json";

const moduleName = parseInt(version) >= 18 ? "./render-18" : "./render-16";

// TODO: Extract type definitions.
export async function load({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
}: {
  wrapperModule: any;
  wrapperName: string;
  componentModule: any;
  componentName: string;
}) {
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
      isEditorDriven: false,
      props: variant.props,
    };
  });
  variants.push({
    key: "custom",
    label: `<${componentName} />`,
    props: {},
    isEditorDriven: true,
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
      const { render } = await import(/* @vite-ignore */ moduleName);
      await render(Renderer, props);
    },
  };
}

export async function detach() {
  const { render } = await import(/* @vite-ignore */ moduleName);
  render(null, {});
}

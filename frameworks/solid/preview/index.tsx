import type { RendererLoader } from "@previewjs/iframe";
import { JSX } from "solid-js/jsx-runtime";
import * as Solid from "solid-js/web";

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
}) => {
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    (({ children }) => <>{children}</>);
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
    const effectiveProps = {
      ...componentModule.default?.args,
      ...Component.args,
      ...props,
    };
    return (
      <Wrapper>
        {decorators.reduce(
          (component, decorator) => () => decorator(component),
          () => <Component {...effectiveProps} />
        )()}
      </Wrapper>
    );
  };
  return {
    variants,
    render: (props) => render(Renderer, props),
  };
};

export async function detach() {
  detachFn();
}

const container = document.getElementById("root");
let detachFn: () => void = () => {
  // This function will be replaced by the real one when the component is loaded.
};
async function render<P>(Renderer: (props: P) => JSX.Element, props: P) {
  detachFn();
  container.innerHTML = "";
  detachFn = Solid.render(() => Renderer(props), container);
}

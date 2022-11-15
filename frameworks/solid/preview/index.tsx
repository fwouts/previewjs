import type { RendererLoader } from "@previewjs/iframe";
import { JSX } from "solid-js/jsx-runtime";
import * as Solid from "solid-js/web";

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
  shouldAbortRender,
}) => {
  const isStoryModule = !!componentModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    (({ children }) => <>{children}</>);
  const ComponentOrStory =
    componentModule[
      componentName === "default" ? "default" : `__previewjs__${componentName}`
    ];
  if (!ComponentOrStory) {
    throw new Error(`No component named '${componentName}'`);
  }
  const decorators = [
    ...(ComponentOrStory.decorators || []),
    ...(componentModule.default?.decorators || []),
  ];
  const variants = (ComponentOrStory.__previewjs_variants || []).map(
    (variant) => {
      return {
        key: variant.key,
        label: variant.label,
        props: variant.props,
      };
    }
  );
  const RenderComponent = isStoryModule
    ? typeof ComponentOrStory === "function"
      ? ComponentOrStory
      : ComponentOrStory.render ||
        ComponentOrStory.component ||
        componentModule.default?.render ||
        componentModule.default?.component ||
        ComponentOrStory
    : ComponentOrStory;
  const Renderer = (props) => {
    const effectiveProps = {
      ...componentModule.default?.args,
      ...ComponentOrStory.args,
      ...props,
    };
    return (
      <Wrapper>
        {decorators.reduce(
          (component, decorator) => () => decorator(component),
          () => <RenderComponent {...effectiveProps} />
        )()}
      </Wrapper>
    );
  };
  return {
    variants,
    render: (props) => {
      if (shouldAbortRender()) {
        return;
      }
      return render(Renderer, props);
    },
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

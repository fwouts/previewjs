import type { RendererLoader } from "@previewjs/iframe";
import * as Solid from "solid-js/web";

const container = document.getElementById("root");
let detachFn: () => void = () => {
  // This function will be replaced by the real one when the component is loaded.
};

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
  const RenderComponent = isStoryModule
    ? typeof ComponentOrStory === "function"
      ? ComponentOrStory
      : ComponentOrStory.render ||
        ComponentOrStory.component ||
        componentModule.default?.render ||
        componentModule.default?.component ||
        ComponentOrStory
    : ComponentOrStory;
  return {
    render: async (getProps: (presetProps?: any) => Record<string, any>) => {
      if (shouldAbortRender()) {
        return;
      }
      detachFn();
      container.innerHTML = "";
      const props = getProps({
        ...componentModule.default?.args,
        ...ComponentOrStory.args,
      });
      detachFn = Solid.render(
        () => (
          <Wrapper>
            {decorators.reduce(
              (component, decorator) => () => decorator(component),
              () => <RenderComponent {...props} />
            )()}
          </Wrapper>
        ),
        container
      );
    },
  };
};

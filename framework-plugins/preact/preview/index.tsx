import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import { Fragment, createElement, render } from "preact";
import { ErrorBoundary, expectErrorBoundary } from "./error-boundary";

const container = document.getElementById("root")!;

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentId,
  renderId,
  shouldAbortRender,
}) => {
  const componentName = componentId.substring(componentId.indexOf(":") + 1);
  const isStoryModule = !!componentModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) || Fragment;
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
    render: async (getProps: GetPropsFn) => {
      if (shouldAbortRender()) {
        return;
      }
      container.innerHTML = "";
      render(
        <ErrorBoundary renderId={renderId}>
          <Wrapper>
            {decorators.reduce(
              (component, decorator) => () => decorator(component),
              () => (
                <RenderComponent
                  {...getProps({
                    presetGlobalProps: componentModule.default?.args || {},
                    presetProps: ComponentOrStory.args || {},
                  })}
                />
              )
            )()}
          </Wrapper>
        </ErrorBoundary>,
        container
      );
      if (shouldAbortRender()) {
        return;
      }
      const errorBoundary = await expectErrorBoundary(
        renderId,
        shouldAbortRender
      );
      if (!errorBoundary) {
        return;
      }
      if (errorBoundary.state.error) {
        throw errorBoundary.state.error;
      }
      if (ComponentOrStory.play) {
        await ComponentOrStory.play({ canvasElement: container });
      }
    },
    jsxFactory: createElement,
  };
};

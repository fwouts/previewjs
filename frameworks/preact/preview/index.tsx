import type { RendererLoader } from "@previewjs/iframe";
import { Fragment, render } from "preact";
import { ErrorBoundary, expectErrorBoundary } from "./error-boundary";

const container = document.getElementById("root");

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
  renderId,
  shouldAbortRender,
}) => {
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
  const Renderer = (props) => {
    return (
      <ErrorBoundary key={renderId} renderId={renderId}>
        <Wrapper>
          {decorators.reduce(
            (component, decorator) => () => decorator(component),
            () => (
              <RenderComponent
                {...componentModule.default?.args}
                {...ComponentOrStory.args}
                {...props}
              />
            )
          )()}
        </Wrapper>
      </ErrorBoundary>
    );
  };
  return {
    render: async (props) => {
      if (shouldAbortRender()) {
        return;
      }
      render(<Renderer {...props} />, container);
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
    },
  };
};

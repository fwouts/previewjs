import type { RendererLoader } from "@previewjs/iframe";
import { render as preactRender, ComponentType, Fragment } from "preact";
import { ErrorBoundary, expectErrorBoundary } from "./error-boundary";

let currentUpdateId = "";

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
  updateId,
}) => {
  currentUpdateId = updateId;
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
      <ErrorBoundary key={updateId} updateId={updateId}>
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
      render(Renderer, props);
      const errorBoundary = await expectErrorBoundary(
        updateId,
        () => currentUpdateId
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

export function render<P>(Renderer: ComponentType<P>, props: P) {
  const container = document.getElementById("root");
  if (!Renderer) {
    preactRender(null, container);
  } else {
    preactRender(<Renderer {...props} />, container);
  }
}

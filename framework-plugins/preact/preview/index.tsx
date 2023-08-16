import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import { Fragment, createElement, render } from "preact";
import { ErrorBoundary, expectErrorBoundary } from "./error-boundary";

const container = document.getElementById("root")!;

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  id,
  renderId,
  shouldAbortRender,
}) => {
  const previewableName = id.substring(id.indexOf(":") + 1);
  const isStoryModule = !!componentModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) || Fragment;
  const Previewable =
    componentModule[
      previewableName === "default"
        ? "default"
        : `__previewjs__${previewableName}`
    ];
  if (!Previewable) {
    throw new Error(`No component or story named '${previewableName}'`);
  }
  const decorators = [
    ...(Previewable.decorators || []),
    ...(componentModule.default?.decorators || []),
  ];

  const RenderComponent = isStoryModule
    ? typeof Previewable === "function"
      ? Previewable
      : Previewable.render ||
        Previewable.component ||
        componentModule.default?.render ||
        componentModule.default?.component ||
        Previewable
    : Previewable;
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
                    presetProps: Previewable.args || {},
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
      if (Previewable.play) {
        await Previewable.play({ canvasElement: container });
      }
    },
    jsxFactory: createElement,
  };
};

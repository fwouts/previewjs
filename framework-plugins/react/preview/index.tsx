import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import React from "react";
import { ErrorBoundary, expectErrorBoundary } from "./error-boundary";
// @ts-ignore
import { render } from "__PREVIEWJS_PLUGIN_REACT_IMPORT_PATH__";
import { rootContainer } from "./root";

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
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    React.Fragment;
  const ComponentOrStory =
    componentModule[
      previewableName === "default"
        ? "default"
        : `__previewjs__${previewableName}`
    ];
  if (!ComponentOrStory) {
    throw new Error(`No component or story named '${previewableName}'`);
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
  const Renderer = (props: any) => {
    return (
      <ErrorBoundary key={renderId} renderId={renderId}>
        <Wrapper>
          {decorators.reduce(
            (component, decorator) => () => decorator(component),
            () => <RenderComponent {...props} />
          )()}
        </Wrapper>
      </ErrorBoundary>
    );
  };
  return {
    render: async (getProps: GetPropsFn) => {
      if (shouldAbortRender()) {
        return;
      }
      await render(
        Renderer,
        getProps({
          presetGlobalProps: componentModule.default?.args || {},
          presetProps: ComponentOrStory.args || {},
        })
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
        await ComponentOrStory.play({ canvasElement: rootContainer });
      }
    },
    jsxFactory: React.createElement,
  };
};

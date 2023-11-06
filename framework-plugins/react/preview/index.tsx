import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import React from "react";
import { ErrorBoundary, expectErrorBoundary } from "./error-boundary";
// @ts-ignore
import { render } from "__PREVIEWJS_PLUGIN_REACT_IMPORT_PATH__";
import { rootContainer } from "./root";

export const loadRenderer: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  previewableModule,
  previewableName,
  renderId,
  shouldAbortRender,
}) => {
  const isStoryModule = !!previewableModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    React.Fragment;
  const Previewable =
    previewableModule[previewableName] ||
    previewableModule.PreviewJsEval(
      `try { return ${previewableName}; } catch { return null; }`
    );
  if (!Previewable) {
    throw new Error(`No component or story named '${previewableName}'`);
  }
  const decorators = [
    ...(Previewable.decorators || []),
    ...(previewableModule.default?.decorators || []),
  ];
  const RenderComponent = isStoryModule
    ? typeof Previewable === "function"
      ? Previewable
      : Previewable.render ||
        Previewable.component ||
        previewableModule.default?.render ||
        previewableModule.default?.component ||
        Previewable
    : Previewable;
  const Renderer = (props: any) => {
    return (
      <ErrorBoundary renderId={renderId}>
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
        <Renderer
          {...getProps({
            presetGlobalProps: previewableModule.default?.args || {},
            presetProps: Previewable.args || {},
          })}
        />
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
        await Previewable.play({ canvasElement: rootContainer });
      }
    },
    jsxFactory: React.createElement,
  };
};

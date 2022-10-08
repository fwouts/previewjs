import type { RendererLoader } from "@previewjs/iframe";
import React from "react";
// @ts-ignore Vite is fine with this
import { version } from "react/package.json";
import { ErrorBoundary, expectErrorBoundary } from "./error-boundary";

const moduleName = parseInt(version) >= 18 ? "./render-18" : "./render-16";

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  componentModule,
  componentName,
  updateId,
}) => {
  const isStoryModule = !!componentModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    React.Fragment;
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
    ? ComponentOrStory.render ||
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
    variants,
    render: async (props) => {
      const { render } = await import(/* @vite-ignore */ moduleName);
      await render(Renderer, props);
      const errorBoundary = await expectErrorBoundary(updateId);
      if (errorBoundary.state.error) {
        throw errorBoundary.state.error;
      }
    },
  };
};

export async function detach() {
  const { render } = await import(/* @vite-ignore */ moduleName);
  render(null, {});
}

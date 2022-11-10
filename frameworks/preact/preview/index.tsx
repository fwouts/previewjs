// @ts-ignore
import type { RendererLoader } from "@previewjs/iframe";
import { render } from './render'
import { Fragment } from 'preact';
import { ErrorBoundary, expectErrorBoundary } from './error-boundary';

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
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    Fragment;
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

export async function detach() {
  render(null, {});
}

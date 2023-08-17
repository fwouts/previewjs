import type { GetPropsFn, RendererLoader } from "@previewjs/iframe";
import type { JSX } from "solid-js";
import h from "solid-js/h";
import * as Solid from "solid-js/web";

const container = document.getElementById("root")!;
let detachFn: () => void = () => {
  // This function will be replaced by the real one when the component is loaded.
};

export const load: RendererLoader = async ({
  wrapperModule,
  wrapperName,
  previewableModule,
  id,
  shouldAbortRender,
}) => {
  const previewableName = id.substring(id.indexOf(":") + 1);
  const isStoryModule = !!previewableModule.default?.component;
  const Wrapper =
    (wrapperModule && wrapperModule[wrapperName || "Wrapper"]) ||
    (({ children }: { children: JSX.Element }) => <>{children}</>);
  const Previewable =
    previewableModule[
      previewableName === "default"
        ? "default"
        : `__previewjs__${previewableName}`
    ];
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
  return {
    render: async (getProps: GetPropsFn) => {
      if (shouldAbortRender()) {
        return;
      }
      detachFn();
      container.innerHTML = "";
      const props = getProps({
        presetGlobalProps: previewableModule.default?.args || {},
        presetProps: Previewable.args || {},
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
      if (Previewable.play) {
        await Previewable.play({ canvasElement: container });
      }
    },
    jsxFactory: h,
  };
};

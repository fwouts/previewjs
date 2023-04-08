import type { RendererLoader } from "../../src";
import { sendMessageFromPreview } from "./messages";
import { getState } from "./state";

export async function updateComponent({
  wrapperModule,
  wrapperName,
  componentModule,
  componentId,
  renderId,
  shouldAbortRender,
  loadingError,
  load,
}: {
  wrapperModule: any;
  wrapperName: string;
  componentModule: any;
  componentId: string;
  renderId: number;
  shouldAbortRender: () => boolean;
  loadingError: string | null;
  load: RendererLoader;
}) {
  const currentState = getState();
  if (!currentState || shouldAbortRender()) {
    return;
  }
  try {
    if (loadingError) {
      sendMessageFromPreview({
        kind: "rendering-error",
        message: loadingError,
      });
      return;
    }
    sendMessageFromPreview({
      kind: "before-render",
    });
    const { render, jsxFactory } = await load({
      wrapperModule,
      wrapperName,
      componentModule,
      componentId,
      renderId,
      shouldAbortRender,
    });
    if (shouldAbortRender()) {
      return;
    }
    const { autogenCallbackProps, properties } =
      await componentModule.PreviewJsEvaluateLocally(
        currentState.autogenCallbackPropsSource,
        currentState.propsAssignmentSource,
        jsxFactory
      );
    sendMessageFromPreview({
      kind: "rendering-setup",
      componentId,
    });
    await render(({ presetProps, presetGlobalProps }) => ({
      ...transformFunctions(autogenCallbackProps, []),
      ...transformFunctions(presetGlobalProps, []),
      ...transformFunctions(properties || presetProps, []),
    }));
    if (shouldAbortRender()) {
      return;
    }
    sendMessageFromPreview({
      kind: "rendering-success",
    });
  } catch (error: any) {
    sendMessageFromPreview({
      kind: "rendering-error",
      message: error.stack || error.message || "Unknown error",
    });
  }
}

/**
 * Ensures that any call to a function within objects and arrays is automatically intercepted
 * and shown to the user.
 */
function transformFunctions(value: any, path: string[]): any {
  if (value && typeof value === "object") {
    if (Array.isArray(value)) {
      // Array.
      return value.map((v, i) =>
        transformFunctions(v, [...path, i.toString(10)])
      );
    }
    if (value.constructor === Object) {
      // Plain object (i.e. not Set or Map or any class instance).
      if (value.$$typeof) {
        // This is likely a React component, e.g. instantiated in a JSX expression.
        // We don't want to show an action invoked when the JSX function is invoked,
        // so skip it.
        return value;
      }
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          typeof v === "function"
            ? (...args: unknown[]) => {
                sendMessageFromPreview({
                  kind: "action",
                  type: "fn",
                  path: [...path, k].join("."),
                });
                return v(...args);
              }
            : transformFunctions(v, [...path, k]),
        ])
      );
    }
  }
  return value;
}

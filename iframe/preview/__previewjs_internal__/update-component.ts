import type { RendererLoader } from "../../src";
import { generateMessageFromError } from "./error-message";
import { getState } from "./state";

export async function updateComponent({
  wrapperModule,
  wrapperName,
  previewableModule,
  previewableName,
  renderId,
  shouldAbortRender,
  loadRenderer,
}: {
  wrapperModule: any;
  wrapperName: string;
  previewableModule: any;
  previewableName: string;
  renderId: number;
  shouldAbortRender: () => boolean;
  loadRenderer: RendererLoader;
}) {
  const currentState = getState();
  if (!currentState || shouldAbortRender()) {
    return;
  }
  try {
    const { render, jsxFactory } = await loadRenderer({
      wrapperModule,
      wrapperName,
      previewableModule,
      previewableName,
      renderId,
      shouldAbortRender,
    });
    if (shouldAbortRender()) {
      return;
    }
    const { autogenCallbackProps, properties } =
      await previewableModule.PreviewJsEvaluateLocally(
        currentState.autogenCallbackPropsSource,
        currentState.propsAssignmentSource,
        jsxFactory
      );
    if (shouldAbortRender()) {
      return;
    }
    await render(({ presetProps, presetGlobalProps }) => ({
      ...transformFunctions(autogenCallbackProps, []),
      ...transformFunctions(presetGlobalProps, []),
      ...transformFunctions(properties || presetProps, []),
    }));
    if (shouldAbortRender()) {
      return;
    }
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "rendered",
    });
  } catch (error: any) {
    window.__PREVIEWJS_IFRAME__.reportEvent({
      kind: "error",
      source: "renderer",
      message: generateMessageFromError(error.message, error.stack),
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
      if (value.__v_isVNode) {
        // This is likely a Vue component (at least Vue 3).
        return value;
      }
      return Object.fromEntries(
        Object.entries(value).map(([k, v]) => [
          k,
          typeof v === "function"
            ? (...args: unknown[]) => {
                window.__PREVIEWJS_IFRAME__.reportEvent({
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

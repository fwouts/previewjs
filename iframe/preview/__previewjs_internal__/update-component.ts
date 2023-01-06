import type { RendererLoader } from "../../src";
import { sendMessageFromPreview } from "./messages";
import { getState } from "./state";

export async function updateComponent({
  wrapperModule,
  wrapperName,
  componentModule,
  componentFilePath,
  componentName,
  renderId,
  shouldAbortRender,
  loadingError,
  load,
}: {
  wrapperModule: any;
  wrapperName: string;
  componentModule: any;
  componentFilePath: string;
  componentName: string;
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
    const { render } = await load({
      wrapperModule,
      wrapperName,
      componentFilePath,
      componentModule,
      componentName,
      renderId,
      shouldAbortRender,
    });
    if (shouldAbortRender()) {
      return;
    }
    let autogenCallbackProps = {};
    eval(`autogenCallbackProps = ${currentState.autogenCallbackPropsSource};`);
    let properties = {};
    eval(`${currentState.propsAssignmentSource};`);
    const invocationProps = properties;
    sendMessageFromPreview({
      kind: "rendering-setup",
      filePath: componentFilePath,
      componentName,
    });
    await render((presetProps = {}) => ({
      ...transformFunctions(autogenCallbackProps, []),
      ...transformFunctions(presetProps, []),
      ...transformFunctions(invocationProps, []),
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

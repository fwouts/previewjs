import type { RendererLoader } from "../../src";
import { sendMessageFromPreview } from "./messages";
import { getState } from "./state";

export async function updateComponent({
  wrapperModule,
  wrapperName,
  componentModule,
  componentFilePath,
  componentName,
  updateId,
  loadingError,
  load,
}: {
  wrapperModule: any;
  wrapperName: string;
  componentModule: any;
  componentFilePath: string;
  componentName: string;
  updateId: string;
  loadingError: string | null;
  load: RendererLoader;
}) {
  const currentState = getState();
  if (!currentState) {
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
    const { variants, render } = await load({
      wrapperModule,
      wrapperName,
      componentFilePath,
      componentModule,
      componentName,
      updateId,
    });
    variants.push({
      key: "custom",
      label: componentName,
      props: {},
      isEditorDriven: true,
    });
    const variant =
      variants.find((v) => v.key === currentState.variantKey) || variants[0];
    if (!variant) {
      throw new Error(`No variant was found.`);
    }
    let defaultProps = {};
    eval(`defaultProps = ${currentState.defaultPropsSource};`);
    if (variant.key === "custom") {
      eval(`
        let properties = {};
        ${currentState.propsAssignmentSource};
        variant.props = properties;
        `);
    }
    sendMessageFromPreview({
      kind: "rendering-setup",
      filePath: componentFilePath,
      componentName,
      variantKey: variant.key,
      // Note: we must remove `props` since it may not be serialisable.
      variants: variants.map(({ props: _, ...rest }) => rest),
    });
    const props = transformFunctions(
      {
        ...defaultProps,
        ...variant.props,
      },
      []
    );
    await render(props);
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
function transformFunctions(value: unknown, path: string[]): unknown {
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

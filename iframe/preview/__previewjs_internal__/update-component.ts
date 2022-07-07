import type { RendererLoader } from "../../src";
import { sendMessageFromPreview } from "./messages";
import { getState } from "./state";

export async function updateComponent({
  wrapperModule,
  wrapperName,
  componentModule,
  componentFilePath,
  componentName,
  loadingError,
  load,
}: {
  wrapperModule: any;
  wrapperName: string;
  componentModule: any;
  componentFilePath: string;
  componentName: string;
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
    const fn = (path: string, returnValue: any) => () => {
      sendMessageFromPreview({ kind: "action", type: "fn", path });
      return returnValue;
    };
    const defaultProps = {
      // Note: this is only there so `fn` doesn't get optimised
      // away :)
      _: fn("", null),
    };
    eval(`
      defaultProps = ${currentState.defaultPropsSource};
      `);
    if (variant.key === "custom") {
      eval(`
        let properties = {};
        ${currentState.customVariantPropsSource};
        variant.props = properties;
        `);
    }
    sendMessageFromPreview({
      kind: "renderer-updated",
      filePath: componentFilePath,
      componentName,
      variantKey: variant.key,
      // Note: we must remove `props` since it may not be serialisable.
      variants: variants.map(({ props: _, ...rest }) => rest),
    });
    await render({
      ...defaultProps,
      ...variant.props,
    });
  } catch (error: any) {
    sendMessageFromPreview({
      kind: "rendering-error",
      message: error.stack || error.message,
    });
  }
}

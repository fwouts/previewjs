import { Variant } from "../..";
import { sendMessageFromPreview } from "./messages";
import { getState } from "./state";

// TODO: Extract type definitions.
export async function updateComponent({
  wrapperModule,
  wrapperName,
  componentModule,
  componentFilePath,
  componentName,
  moduleLoadingError,
  load,
}: {
  wrapperModule: any;
  wrapperName: string;
  componentModule: any;
  componentFilePath: string;
  componentName: string;
  moduleLoadingError: string | null;
  load: (options: {
    wrapperModule: any;
    wrapperName: string;
    componentModule: any;
    componentName: string;
  }) => Promise<{
    variants: Array<
      Variant & {
        props?: any;
      }
    >;
    render: (props: any) => Promise<void>;
  }>;
}) {
  const currentState = getState();
  if (!currentState) {
    return;
  }
  try {
    const { variants, render } = await load({
      wrapperModule,
      wrapperName,
      componentModule,
      componentName,
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
    let defaultProps = {
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
      variants: variants.map(({ props, ...rest }) => rest),
      loadingError: moduleLoadingError,
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

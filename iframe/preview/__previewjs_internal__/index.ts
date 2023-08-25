import type { RenderOptions } from "../../src";
import { overrideCopyCutPaste } from "./copy-cut-paste";
import { setUpLinkInterception } from "./links";
import { setUpLogInterception } from "./logs";
import { sendMessageFromPreview } from "./messages";
import { load as loadRenderer } from "./renderer";
import { setState } from "./state";
import { updateComponent } from "./update-component";
import { setupViteHmrListener } from "./vite-hmr-listener";

// Important: initListeners() must be invoked before we try to load any modules
// that might fail to load, such as a component, so we can intercept Vite errors.
export function initListeners() {
  setupViteHmrListener();
  setUpLogInterception();
  setUpLinkInterception();
  overrideCopyCutPaste();
}

export function initPreview({
  previewableModule,
  id,
  wrapperModule,
  wrapperName,
}: {
  previewableModule: any;
  id: string;
  wrapperModule: any;
  wrapperName: string;
}) {
  let renderId = 0;

  async function render({
    autogenCallbackPropsSource,
    propsAssignmentSource,
  }: RenderOptions) {
    try {
      renderId += 1;
      setState({
        previewableId: id,
        autogenCallbackPropsSource,
        propsAssignmentSource,
      });
      const thisRenderId = renderId;
      await updateComponent({
        wrapperModule,
        wrapperName,
        previewableModule,
        id,
        renderId,
        shouldAbortRender: () => renderId !== thisRenderId,
        load: loadRenderer,
      });
    } catch (error: any) {
      sendMessageFromPreview({
        kind: "rendering-error",
        message: error.stack || error.message,
      });
    }
  }

  const root = document.getElementById("root");
  if (!root) {
    throw new Error(`Unable to find #root!`);
  }

  let lastRenderOptions: RenderOptions | null = null;
  window.__PREVIEWJS_IFRAME__ = {
    render: async (data) => {
      lastRenderOptions = data;
      await render(data);
    },
  };

  sendMessageFromPreview({
    kind: "bootstrapped",
  });

  return (updatedPreviewableModule: any, updatedWrapperModule: any) => {
    previewableModule = updatedPreviewableModule;
    wrapperModule = updatedWrapperModule;
    if (lastRenderOptions) {
      // eslint-disable-next-line no-console
      render(lastRenderOptions).catch(console.error);
    }
  };
}

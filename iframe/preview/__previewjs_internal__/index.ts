import type { AppToPreviewMessage, RenderMessage } from "../../src/messages";
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
  componentModule,
  componentId,
  wrapperModule,
  wrapperName,
}: {
  componentModule: any;
  componentId: string;
  wrapperModule: any;
  wrapperName: string;
}) {
  let renderId = 0;

  async function load({
    autogenCallbackPropsSource,
    propsAssignmentSource,
  }: RenderMessage) {
    try {
      renderId += 1;
      setState({
        autogenCallbackPropsSource,
        propsAssignmentSource,
      });
      const thisRenderId = renderId;
      await updateComponent({
        wrapperModule,
        wrapperName,
        componentModule,
        componentId,
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

  let lastRenderMessage: RenderMessage | null = null;
  window.addEventListener(
    "message",
    (event: MessageEvent<AppToPreviewMessage>) => {
      const data = event.data;
      switch (data.kind) {
        case "render":
          lastRenderMessage = data;
          // eslint-disable-next-line no-console
          load(data).catch(console.error);
          break;
      }
    }
  );

  sendMessageFromPreview({
    kind: "bootstrapped",
  });

  return (updatedComponentModule: any, updatedWrapperModule: any) => {
    componentModule = updatedComponentModule;
    wrapperModule = updatedWrapperModule;
    if (lastRenderMessage) {
      // eslint-disable-next-line no-console
      load(lastRenderMessage).catch(console.error);
    }
  };
}

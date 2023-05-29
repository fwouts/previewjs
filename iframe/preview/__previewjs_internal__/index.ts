import type { AppToPreviewMessage, RenderMessage } from "../../src/messages";
import { overrideCopyCutPaste } from "./copy-cut-paste";
import { setUpLinkInterception } from "./links";
import { setUpLogInterception } from "./logs";
import { sendMessageFromPreview } from "./messages";
import { load as loadRenderer } from "./renderer";
import { setState } from "./state";
import { updateComponent } from "./update-component";
import { setupViteHmrListener } from "./vite-hmr-listener";

export async function initPreview({
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
  setupViteHmrListener();
  setUpLogInterception();
  setUpLinkInterception();
  overrideCopyCutPaste();

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
        // TODO: Figure this out.
        loadingError: null,
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
  window.addEventListener(
    "message",
    (event: MessageEvent<AppToPreviewMessage>) => {
      const data = event.data;
      switch (data.kind) {
        case "render":
          // eslint-disable-next-line no-console
          load(data).catch(console.error);
          break;
      }
    }
  );

  sendMessageFromPreview({
    kind: "bootstrapped",
  });
}

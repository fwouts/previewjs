import type { AppToPreviewMessage, RenderMessage } from "../../src/messages";
import { overrideCopyCutPaste } from "./copy-cut-paste";
import { setUpLinkInterception } from "./links";
import { setUpLogInterception } from "./logs";
import { sendMessageFromPreview } from "./messages";
import { setState } from "./state";
import { setupViteHmrListener } from "./vite-hmr-listener";
// @ts-ignore
import { componentLoader } from "./component-loader.js";

setupViteHmrListener();
setUpLogInterception();
setUpLinkInterception();
overrideCopyCutPaste();

let componentLoadId = 0;

async function load({
  filePath,
  componentName,
  autogenCallbackPropsSource,
  propsAssignmentSource,
}: RenderMessage) {
  const currentComponentLoadId = ++componentLoadId;
  try {
    setState({
      filePath,
      componentName,
      autogenCallbackPropsSource,
      propsAssignmentSource,
    });
    const { init, refresh } = await componentLoader(filePath, componentName);
    init({
      componentLoadId: currentComponentLoadId,
      getLatestComponentLoadId: () => componentLoadId,
    });
    await refresh();
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
        load(data).catch(console.error);
        break;
    }
  }
);

sendMessageFromPreview({
  kind: "bootstrapped",
});

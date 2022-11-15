import type { AppToPreviewMessage, RenderMessage } from "../../src/messages";
import { overrideCopyCutPaste } from "./copy-cut-paste";
import { setUpLinkInterception } from "./links";
import { setUpLogInterception } from "./logs";
import { sendMessageFromPreview } from "./messages";
import { detach } from "./renderer/index";
import { setState } from "./state";

setUpLogInterception();
setUpLinkInterception();
overrideCopyCutPaste();

let componentLoadId = 0;

async function load({
  filePath,
  componentName,
  defaultPropsSource,
  propsAssignmentSource,
}: RenderMessage) {
  const currentComponentLoadId = ++componentLoadId;
  try {
    setState({
      filePath,
      componentName,
      defaultPropsSource,
      propsAssignmentSource,
    });
    const componentLoaderUrl = `/preview/@component-loader.js?p=${encodeURIComponent(
      filePath
    )}&c=${encodeURIComponent(componentName)}`;
    const { init, refresh } = await import(
      /* @vite-ignore */ componentLoaderUrl
    );
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
const rootLoadingHtml = root.innerHTML;
let loading = false;
window.addEventListener(
  "message",
  (event: MessageEvent<AppToPreviewMessage>) => {
    const data = event.data;
    switch (data.kind) {
      case "show-loading":
        loading = true;
        detach()
          .then(() => {
            if (!loading || !root) {
              return;
            }
            root.innerHTML = rootLoadingHtml;
          })
          .catch(console.error);
        break;
      case "render":
        loading = false;
        load(data).catch(console.error);
        break;
    }
  }
);

sendMessageFromPreview({
  kind: "bootstrapped",
});

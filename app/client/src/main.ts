import { createAxiosApi, RPCs } from "@previewjs/api";
import { createController } from "@previewjs/iframe";
import {
  generateCallbackProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";

const iframe = document.getElementById("root") as HTMLIFrameElement;
const rpcApi = createAxiosApi("/api/");
const iframeController = createController({
  getIframe: () => iframe,
  listener: () => {
    // No-op.
  },
});

window.addEventListener("message", (event: MessageEvent) => {
  if (event.data && event.data.kind === "navigate") {
    history.pushState(
      null,
      "",
      `/?p=${encodeURIComponent(event.data.componentId)}`
    );
    onUrlChanged().catch(console.error);
  }
});
window.addEventListener("popstate", () => {
  onUrlChanged().catch(console.error);
});
iframeController.start();
onUrlChanged().catch(console.error);

async function onUrlChanged() {
  const urlParams = new URLSearchParams(document.location.search);
  const componentId = urlParams.get("p") || "";
  if (!componentId.includes(":")) {
    return;
  }
  const [filePath, componentName] = componentId.split(":") as [string, string];
  iframeController.resetIframe();
  const computePropsResponse = await rpcApi.request(RPCs.ComputeProps, {
    filePath,
    componentName,
  });
  const autogenCallbackProps = generateCallbackProps(
    computePropsResponse.types.props,
    computePropsResponse.types.all
  );
  iframeController.loadComponent({
    filePath,
    componentName,
    propsAssignmentSource: generatePropsAssignmentSource(
      computePropsResponse.types.props,
      autogenCallbackProps.keys,
      computePropsResponse.types.all
    ),
    autogenCallbackPropsSource: autogenCallbackProps.source,
  });
}

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
  listener: (event) => {
    console.log(event);
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
    componentIds: [componentId],
  });
  const propsType = computePropsResponse.components[componentId]!.props;
  const autogenCallbackProps = generateCallbackProps(
    propsType,
    computePropsResponse.types
  );
  iframeController.loadComponent({
    filePath,
    componentName,
    propsAssignmentSource: generatePropsAssignmentSource(
      propsType,
      autogenCallbackProps.keys,
      computePropsResponse.types
    ),
    autogenCallbackPropsSource: autogenCallbackProps.source,
  });
}

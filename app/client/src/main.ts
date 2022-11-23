import { Api, createAxiosApi, RPCs } from "@previewjs/api";
import { createController, PreviewIframeController } from "@previewjs/iframe";
import {
  generateDefaultProps,
  generatePropsAssignmentSource,
} from "@previewjs/properties";

const iframe = document.getElementById("root") as HTMLIFrameElement;
const state = new PreviewState();

state.start().catch(console.error);

class PreviewState {
  private readonly iframeController: PreviewIframeController;
  private readonly rpcApi: Api;

  constructor() {
    this.rpcApi = createAxiosApi("/api/");
    this.iframeController = createController({
      getIframe: () => iframe,
      listener: () => {
        // No-op.
      },
    });
  }

  async start() {
    window.addEventListener("message", this.messageListener);
    window.addEventListener("popstate", this.popStateListener);
    this.iframeController.start();
    await this.onUrlChanged();
  }

  stop() {
    this.iframeController.stop();
    window.removeEventListener("message", this.messageListener);
    window.removeEventListener("popstate", this.popStateListener);
  }

  private messageListener = (event: MessageEvent) => {
    const data = event.data;
    if (data && data.kind === "navigate") {
      history.pushState(
        null,
        "",
        `/?p=${encodeURIComponent(data.componentId)}`
      );
      this.onUrlChanged().catch(console.error);
    }
  };

  private popStateListener = () => {
    this.onUrlChanged().catch(console.error);
  };

  private async onUrlChanged() {
    const urlParams = new URLSearchParams(document.location.search);
    const componentId = urlParams.get("p") || "";
    if (!componentId.includes(":")) {
      return;
    }
    const [filePath, componentName] = componentId.split(":") as [
      string,
      string
    ];
    this.iframeController.resetIframe();
    const computePropsResponse = await this.rpcApi.request(RPCs.ComputeProps, {
      filePath,
      componentName,
    });
    const defaultProps = generateDefaultProps(
      computePropsResponse.types.props,
      computePropsResponse.types.all
    );
    this.iframeController.loadComponent({
      filePath,
      componentName,
      propsAssignmentSource: generatePropsAssignmentSource(
        computePropsResponse.types.props,
        defaultProps.keys,
        computePropsResponse.types.all
      ),
      defaultPropsSource: defaultProps.source,
    });
  }
}

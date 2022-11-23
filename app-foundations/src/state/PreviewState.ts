import type { Api } from "@previewjs/api";
import { createController, PreviewIframeController } from "@previewjs/iframe";
import "../window";
import { decodeComponentId } from "./component-id";
import { ComponentProps } from "./ComponentProps";

export class PreviewState {
  readonly iframeController: PreviewIframeController;

  private component: {
    filePath: string;
    name: string;
    props: ComponentProps;
  } | null = null;
  private getIframe = (): HTMLIFrameElement | null => null;

  constructor(
    private readonly rpcApi: Api,
    getIframe: () => HTMLIFrameElement | null
  ) {
    this.iframeController = createController({
      getIframe,
      listener: () => {
        // No-op.
      },
    });
  }

  async start() {
    window.__previewjs_navigate = (componentId) => {
      history.pushState(null, "", `/?p=${encodeURIComponent(componentId)}`);
      this.onUrlChanged().catch(console.error);
    };
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
      window.__previewjs_navigate(data.componentId);
    }
  };

  private popStateListener = () => {
    this.onUrlChanged().catch(console.error);
  };

  private async onUrlChanged() {
    const urlParams = new URLSearchParams(document.location.search);
    const componentId = urlParams.get("p") || "";
    const decodedComponentId = decodeComponentId(componentId);
    if (!decodedComponentId.component) {
      return;
    }
    const name = decodedComponentId.component.name;
    this.iframeController.resetIframe();
    const filePath = decodedComponentId.component.filePath;
    const props = new ComponentProps(this.rpcApi, filePath, name);
    await props.refresh();
    this.component = {
      ...decodedComponentId.component,
      props,
    };
    this.renderComponent();
  }

  private renderComponent() {
    if (!this.component) {
      return;
    }
    this.iframeController.loadComponent({
      filePath: this.component.filePath,
      componentName: this.component.name,
      propsAssignmentSource: this.component.props.invocationSource,
      defaultPropsSource: this.component.props.defaultProps.source,
    });
  }
}

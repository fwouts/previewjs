import { Api, localEndpoints, ResponseOf } from "@previewjs/api";
import {
  createController,
  PreviewIframeController,
  Variant,
} from "@previewjs/iframe";
import assertNever from "assert-never";
import { makeAutoObservable, observable, runInAction } from "mobx";
import { ActionLogsState } from "../components/ActionLogs";
import { ConsolePanelState } from "../components/ConsolePanel";
import { UpdateBannerState } from "../components/UpdateBanner";
import "../window";
import { decodeComponentId } from "./component-id";
import { ComponentProps } from "./ComponentProps";
import { PersistedStateController } from "./PersistedStateController";

const REFRESH_PERIOD_MILLIS = 5000;

export class PreviewState {
  readonly iframeController: PreviewIframeController;
  readonly actionLogs = new ActionLogsState();
  readonly consoleLogs = new ConsolePanelState();
  readonly updateBanner: UpdateBannerState;
  reachable = true;

  component: {
    /**
     * ID of the component, comprising of a file path and local component ID.
     *
     * Follows the following format: <filePath>:<file-relative id>
     *
     * For example, a component "Foo" in src/App.tsx will have the ID "src/App.tsx:Foo"
     */
    componentId: string;

    /**
     * Human-friendly component name, such as "Foo".
     *
     * Typically corresponds to the second part of component ID, but not necessarily.
     */
    name: string;

    /**
     * Key of the component's variant currently displayed.
     *
     * Set to "custom" when a preconfigured variant isn't being used.
     *
     * Null when the component is still loading and information about its variants hasn't been
     * loaded yet (see details.variants below).
     */
    variantKey: string | null;

    details: {
      /**
       * File path where the component is loaded from. This typically corresponds to the first part
       * of the component ID, but not necessarily (e.g. storybook stories in a different file).
       */
      filePath: string;

      props: ComponentProps;

      /**
       * List of preconfigured variants for the component, if any.
       *
       * Null while the list of variants hasn't yet been loaded (this may only happen at runtime).
       */
      variants: Variant[] | null;
    } | null;
  } | null = null;
  appInfo: ResponseOf<typeof localEndpoints.GetInfo>["appInfo"] | null = null;

  private iframeRef: React.RefObject<HTMLIFrameElement | null> = {
    current: null,
  };
  private cachedInvocations: Record<string, string> = {};
  private pingInterval: NodeJS.Timer | null = null;

  constructor(
    private readonly localApi: Api,
    webApi: Api,
    private readonly persistedStateController: PersistedStateController,
    private readonly options: {
      onFileChanged?: (filePath: string | null) => Promise<void>;
    } = {}
  ) {
    this.updateBanner = new UpdateBannerState(
      webApi,
      this.persistedStateController
    );
    this.iframeController = createController({
      getIframe: () => this.iframeRef.current,
      listener: (event) => {
        runInAction(() => {
          if (!this.component?.details) {
            return;
          }
          switch (event.kind) {
            case "bootstrapped":
            case "before-render":
              this.consoleLogs.onClear();
              break;
            case "update":
              this.consoleLogs.onClear();
              if (event.rendering?.kind === "success") {
                this.component.variantKey = event.rendering.variantKey;
                this.component.details.variants = event.rendering.variants;
              }
              break;
            case "log-message":
              this.consoleLogs.onConsoleMessage(event);
              break;
            case "action":
              this.actionLogs.onAction(event);
              break;
            default:
              throw assertNever(event);
          }
        });
      },
    });
    makeAutoObservable<
      PreviewState,
      // Note: private fields must be explicitly added here.
      "iframeRef" | "pingInterval"
    >(this, {
      iframeRef: observable.ref,
      pingInterval: observable.ref,
      appInfo: observable.ref,
    });
  }

  async start() {
    window.__previewjs_navigate = (componentId, variantKey) => {
      history.pushState(
        null,
        "",
        `/?p=${componentId}${variantKey ? `&v=${variantKey}` : ""}`
      );
      this.onUrlChanged().catch(console.error);
    };
    window.addEventListener("message", this.messageListener);
    window.addEventListener("popstate", this.popStateListener);
    this.iframeController.start();
    await this.onUrlChanged();
    this.pingInterval = setInterval(() => {
      this.ping().catch(console.error);
    }, REFRESH_PERIOD_MILLIS);
    document.addEventListener("keydown", this.keydownListener);
    const { appInfo } = await this.localApi.request(localEndpoints.GetInfo);
    runInAction(() => {
      this.appInfo = appInfo;
    });
    await this.persistedStateController.start();
    await this.updateBanner.start(appInfo);
  }

  stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.iframeController.stop();
    window.removeEventListener("message", this.messageListener);
    window.removeEventListener("popstate", this.popStateListener);
    document.removeEventListener("keydown", this.keydownListener);
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

  private keydownListener = (e: KeyboardEvent) => {
    if (!navigator.userAgent.includes(" Code/")) {
      // This is only needed to fix copy-paste in VS Code.
      return;
    }
    const hasMeta = e.ctrlKey || e.metaKey;
    if (!hasMeta) {
      return;
    }
    switch (e.key.toLowerCase()) {
      case "c":
        document.execCommand("copy");
        e.preventDefault();
        break;
      case "x":
        document.execCommand("cut");
        e.preventDefault();
        break;
      case "v":
        document.execCommand("paste");
        e.preventDefault();
        break;
    }
  };

  setIframeRef(iframeRef: React.RefObject<HTMLIFrameElement | null>) {
    if (iframeRef === this.iframeRef) {
      return;
    }
    this.iframeRef = iframeRef;
    this.renderComponent();
  }

  setComponent(componentId: string) {
    if (componentId === this.component?.componentId) {
      this.setVariant("custom");
    } else {
      window.__previewjs_navigate(componentId);
    }
  }

  setVariant(variantKey: string) {
    if (!this.component) {
      return;
    }
    window.__previewjs_navigate(this.component.componentId, variantKey);
  }

  updateProps(source: string) {
    if (!this.component?.details) {
      return;
    }
    this.component.details.props.setInvocationSource(source);
    this.cachedInvocations[this.component.componentId] = source;
    this.renderComponent();
  }

  resetProps() {
    if (!this.component?.details) {
      return;
    }
    this.component.details.props.setInvocationSource(null);
    delete this.cachedInvocations[this.component.componentId];
    this.renderComponent();
  }

  private async onUrlChanged() {
    const urlParams = new URLSearchParams(document.location.search);
    const componentId = urlParams.get("p") || "";
    const variantKey = urlParams.get("v") || null;
    const decodedComponentId = decodeComponentId(componentId);
    if (this.options.onFileChanged) {
      await this.options.onFileChanged(decodedComponentId.currentFilePath);
    }
    if (!decodedComponentId.component) {
      this.component = null;
      return;
    }
    const name = decodedComponentId.component.name;
    if (this.component?.componentId === componentId) {
      runInAction(() => {
        if (this.component) {
          this.component.variantKey = variantKey;
        }
      });
    } else {
      this.iframeController.showLoading();
      runInAction(() => {
        this.component = {
          componentId,
          name,
          variantKey,
          details: null,
        };
      });
      const response = await this.localApi.request(
        localEndpoints.ComputeProps,
        {
          filePath: decodedComponentId.component.filePath,
          componentName: name,
        }
      );
      const filePath = decodedComponentId.component.filePath;
      runInAction(() => {
        this.component = {
          componentId,
          name,
          variantKey,
          details: {
            filePath,
            variants: null,
            props: new ComponentProps(
              name,
              response.types,
              response.args,
              this.cachedInvocations[componentId] || null
            ),
          },
        };
      });
    }
    this.renderComponent();
  }

  private renderComponent() {
    if (!this.component?.details) {
      return;
    }
    this.consoleLogs.onClear();
    this.iframeController.loadComponent({
      componentName: this.component.name,
      filePath: this.component.details.filePath,
      variantKey: this.component.variantKey,
      customVariantPropsSource: this.component.details.props.invocationSource,
      defaultPropsSource: this.component.details.props.defaultPropsSource,
    });
  }

  private async ping() {
    let reachable: boolean;
    try {
      await fetch("/ping/");
      reachable = true;
    } catch (e) {
      console.warn(e);
      reachable = false;
    }
    runInAction(() => {
      this.reachable = reachable;
    });
  }
}

import { Api, ResponseOf, RPCs } from "@previewjs/api";
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
import type { PersistedStateController } from "./PersistedStateController";

const REFRESH_PERIOD_MILLIS = 5000;

export class PreviewState {
  readonly iframeController: PreviewIframeController;
  readonly actionLogs = new ActionLogsState();
  readonly consoleLogs = new ConsolePanelState();
  readonly updateBanner: UpdateBannerState;
  reachable = true;

  detectComponentsResponse:
    | {
        kind: "loading";
      }
    | {
        kind: "success";
        response: RPCs.DetectComponentsResponse;
      }
    | {
        kind: "failure";
        message: string;
      } = {
    kind: "loading",
  };

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

      /**
       * Whether or not rendering failed on every render.
       *
       * Used to show a fullscreen error for components that never render successfully, instead
       * of a loading screen with logs panel hidden by default.
       *
       * Null when rendering hasn't finished yet.
       */
      renderingAlwaysFailing: boolean | null;
    } | null;
  } | null = null;
  appInfo: ResponseOf<typeof RPCs.GetInfo>["appInfo"] | null = null;

  private iframeRef: React.RefObject<HTMLIFrameElement | null> = {
    current: null,
  };
  private cachedInvocations: Record<string, string> = {};
  private pingInterval: NodeJS.Timer | null = null;

  constructor(
    private readonly rpcApi: Api,
    private readonly persistedStateController: PersistedStateController,
    private readonly options: {
      onFileChanged?: (filePath: string | null) => Promise<void>;
    } = {}
  ) {
    this.updateBanner = new UpdateBannerState(this.persistedStateController);
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
            case "before-vite-update":
              this.consoleLogs.onClear();
              if (this.component.details.renderingAlwaysFailing) {
                this.iframeController.resetIframe();
              }
              break;
            case "file-changed":
              if (this.component.details.renderingAlwaysFailing) {
                this.iframeController.resetIframe();
              }
              break;
            case "rendering-setup":
              this.component.variantKey = event.info.variantKey;
              this.component.details.variants = event.info.variants;
              break;
            case "rendering-done":
              if (this.component.details.renderingAlwaysFailing === null) {
                this.component.details.renderingAlwaysFailing = !event.success;
              } else if (event.success) {
                this.component.details.renderingAlwaysFailing = false;
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
      detectComponentsResponse: observable.ref,
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
    this.pingInterval = setInterval(() => {
      this.ping()
        .then(() => this.component?.details?.props.refresh())
        .catch(console.error);
    }, REFRESH_PERIOD_MILLIS);
    document.addEventListener("keydown", this.keydownListener);
    const { appInfo } = await this.rpcApi.request(RPCs.GetInfo);
    runInAction(() => {
      this.appInfo = appInfo;
    });
    await this.persistedStateController.start();
    await this.updateBanner.start(appInfo);
    try {
      const project = await this.rpcApi.request(RPCs.DetectComponents, {
        forceRefresh: false,
      });
      runInAction(() => {
        this.detectComponentsResponse = {
          kind: "success",
          response: project,
        };
      });
    } catch (e: any) {
      runInAction(() => {
        this.detectComponentsResponse = {
          kind: "failure",
          message: e.message || "Unknown error",
        };
      });
    }
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
      case "a":
        document.execCommand("selectAll");
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
    const component = this.component;
    if (!component) {
      return;
    }
    runInAction(() => {
      this.component = {
        ...component,
        variantKey,
      };
    });
    this.renderComponent();
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
    const decodedComponentId = decodeComponentId(componentId);
    if (!decodedComponentId.component) {
      runInAction(() => {
        this.component = null;
      });
      if (this.options.onFileChanged) {
        await this.options.onFileChanged(decodedComponentId.currentFilePath);
      }
      return;
    }
    const name = decodedComponentId.component.name;
    this.iframeController.showLoading();
    runInAction(() => {
      this.component = {
        componentId,
        name,
        variantKey: null,
        details: null,
      };
    });
    if (this.options.onFileChanged) {
      await this.options.onFileChanged(decodedComponentId.currentFilePath);
    }
    const filePath = decodedComponentId.component.filePath;
    const props = new ComponentProps(
      this.rpcApi,
      filePath,
      name,
      this.cachedInvocations[componentId] || null
    );
    await props.refresh();
    runInAction(() => {
      this.component = {
        componentId,
        name,
        variantKey: null,
        details: {
          filePath,
          variants: null,
          props,
          renderingAlwaysFailing: null,
        },
      };
    });
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
      propsAssignmentSource: this.component.details.props.invocationSource,
      defaultPropsSource: this.component.details.props.defaultProps.source,
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

import { localEndpoints, PersistedState, webEndpoints } from "@previewjs/api";
import {
  createController,
  PreviewIframeController,
  Variant,
} from "@previewjs/core/controller";
import assertNever from "assert-never";
import { makeAutoObservable, observable, runInAction } from "mobx";
import { LocalApi } from "./api/local";
import { WebApi } from "./api/web";
import {
  componentNameFromComponentId,
  filePathFromComponentId,
} from "./component-id";
import { ActionLogsState } from "./components/ActionLogs";
import { ConsoleLogsState } from "./components/ConsoleLogs";
import { ErrorState } from "./components/Error";
import "./window";

const REFRESH_PERIOD_MILLIS = 5000;

export class PreviewState {
  readonly localApi: LocalApi;
  readonly webApi: WebApi;
  readonly controller: PreviewIframeController;
  readonly actionLogs = new ActionLogsState();
  readonly consoleLogs = new ConsoleLogsState();
  readonly error = new ErrorState();
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

      /**
       * Source of default props that should be passed to the component.
       *
       * Typically this is "{}" (empty object) but when we know more about the component, we may
       * provide better defaults such as callback implementations, e.g. "{ onClick: fn(...) }".
       *
       * Unlike defaultInvocation, defaultProps is not shown to the user.
       */
      defaultProps: string;

      /**
       * Default source of invocation, used to fill the initial content of the props editor (unless
       * a preconfigured variant is used).
       *
       * This is typically `properties = {};` unless we're able to infer information about the
       * component's props.
       */
      defaultInvocation: string;

      /**
       * Source of invocation used to render the component. This may differ from defaultInvocation,
       * specifically when the user has edited the props editor.
       */
      invocation: string;

      /**
       * Type declarations used by the props editor to offer better autocomplete and type checking.
       */
      typeDeclarations: string;

      /**
       * List of preconfigured variants for the component, if any.
       *
       * Null while the list of variants hasn't yet been loaded (this may only happen at runtime).
       */
      variants: Variant[] | null;
    } | null;
  } | null = null;
  appInfo: { platform: string; version: string } | null = null;
  checkVersionResponse: webEndpoints.CheckVersionResponse | null = null;
  persistedState: PersistedState | null = null;

  private iframeRef: React.RefObject<HTMLIFrameElement | null> = {
    current: null,
  };
  private cachedInvocations: Record<string, string> = {};
  private pingInterval: NodeJS.Timer | null = null;

  constructor(
    private readonly options: {
      onFileChanged?: (filePath: string | null) => Promise<void>;
    } = {}
  ) {
    this.localApi = new LocalApi("/api/");
    this.webApi = new WebApi("https://previewjs.com/api/");
    this.controller = createController({
      getIframe: () => this.iframeRef.current,
      listener: (event) => {
        runInAction(() => {
          if (!this.component?.details) {
            return;
          }
          switch (event.kind) {
            case "update":
              this.error.update(event);
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
      checkVersionResponse: observable.ref,
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
    this.controller.start();
    await this.onUrlChanged();
    this.pingInterval = setInterval(() => {
      this.ping().catch(console.error);
    }, REFRESH_PERIOD_MILLIS);
    document.addEventListener("keydown", this.keydownListener);
    const { appInfo } = await this.localApi.request(localEndpoints.GetInfo);
    runInAction(() => {
      this.appInfo = appInfo;
    });
    const state = await this.localApi.request(localEndpoints.GetState);
    runInAction(() => {
      this.persistedState = state;
    });
    try {
      const checkVersionResponse = await this.webApi.request(
        webEndpoints.CheckVersion,
        {
          appInfo,
        }
      );
      runInAction(() => {
        this.checkVersionResponse = checkVersionResponse;
      });
    } catch (e) {
      console.warn(e);
      // Don't crash. This is an optional check.
    }
  }

  stop() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    this.controller.stop();
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
    this.component.details.invocation = source;
    this.cachedInvocations[this.component.componentId] = source;
    this.renderComponent();
  }

  resetProps() {
    if (!this.component?.details) {
      return;
    }
    this.component.details.invocation =
      this.component.details.defaultInvocation;
    delete this.cachedInvocations[this.component.componentId];
    this.renderComponent();
  }

  async onUpdateDismissed() {
    const state = await this.localApi.request(localEndpoints.UpdateState, {
      updateDismissed: {
        timestamp: Date.now(),
      },
    });
    runInAction(() => {
      this.persistedState = state;
    });
  }

  private async onUrlChanged() {
    const urlParams = new URLSearchParams(document.location.search);
    const componentId = urlParams.get("p") || "";
    const variantKey = urlParams.get("v") || null;
    const filePath = filePathFromComponentId(componentId);
    const nameFromPath = componentNameFromComponentId(componentId);
    if (this.options.onFileChanged) {
      await this.options.onFileChanged(filePath);
    }
    if (!filePath || !nameFromPath) {
      this.component = null;
      return;
    }
    const name = nameFromPath;
    if (this.component?.componentId === componentId) {
      runInAction(() => {
        if (this.component) {
          this.component.variantKey = variantKey;
        }
      });
    } else {
      this.controller.showLoading();
      runInAction(() => {
        this.component = {
          componentId,
          name,
          variantKey,
          details: null,
        };
      });
      const sources = await this.localApi.request(localEndpoints.ComputeProps, {
        filePath,
        componentName: name,
      });
      const details = {
        filePath,
        componentName: name,
        defaultProps: sources?.defaultPropsSource || "{}",
        invocation:
          this.cachedInvocations[componentId] ||
          sources?.defaultInvocationSource ||
          `properties = {
  // foo: "bar"
}`,
        typeDeclarations:
          sources?.typeDeclarationsSource || `declare let properties: any;`,
      };
      runInAction(() => {
        this.component = {
          componentId,
          name,
          variantKey,
          details: {
            filePath: details.filePath,
            variants: null,
            defaultProps: details.defaultProps,
            defaultInvocation: details.invocation,
            invocation: details.invocation,
            typeDeclarations: details.typeDeclarations,
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
    this.controller.loadComponent({
      componentName: this.component.name,
      filePath: this.component.details.filePath,
      variantKey: this.component.variantKey,
      customVariantPropsSource: this.component.details.invocation,
      defaultPropsSource: this.component.details.defaultProps,
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

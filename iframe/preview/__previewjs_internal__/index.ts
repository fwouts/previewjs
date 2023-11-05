import { overrideCopyCutPaste } from "./copy-cut-paste";
import { setUpLinkInterception } from "./links";
import { setUpLogInterception } from "./logs";
import { loadRenderer } from "./renderer";
import { runRenderer } from "./run-renderer";
import { setState } from "./state";
import { setupViteHmrListener } from "./vite-hmr-listener";

// Important: initListeners() must be invoked before we try to load any modules
// that might fail to load, such as a component, so we can intercept Vite errors.
export function initListeners() {
  setupViteHmrListener();
  setUpLogInterception();
  setUpLinkInterception();
  overrideCopyCutPaste();
}

export function initPreview({
  previewableModule,
  previewableName,
  wrapperModule,
  wrapperName,
}: {
  previewableModule: any;
  previewableName: string;
  wrapperModule: any;
  wrapperName: string;
}): typeof window.__PREVIEWJS_IFRAME__.refresh {
  const root = document.getElementById("root")!;
  if (!root) {
    throw new Error(`Unable to find #root!`);
  }
  let renderId = 0;

  async function runNewRender() {
    const rootHtml = root.innerHTML;
    try {
      renderId += 1;
      const thisRenderId = renderId;
      await runRenderer({
        wrapperModule,
        wrapperName,
        previewableModule,
        previewableName,
        renderId,
        shouldAbortRender: () => renderId !== thisRenderId,
        loadRenderer,
      });
    } catch (error: any) {
      if (root.innerHTML !== rootHtml) {
        // Restore the previous content so we don't end up with an empty page instead.
        root.innerHTML = rootHtml;
      }
      window.__PREVIEWJS_IFRAME__.reportEvent({
        kind: "error",
        source: "renderer",
        message: error.stack || error.message,
      });
    }
  }

  window.__PREVIEWJS_IFRAME__.render = async (data) => {
    setState(data);
    await runNewRender();
  };

  window.__PREVIEWJS_IFRAME__.reportEvent({
    kind: "bootstrapped",
  });

  return (options = {}) => {
    if (options.previewableModule) {
      previewableModule = options.previewableModule;
    }
    if (options.wrapperModule) {
      wrapperModule = options.wrapperModule;
    }
    // eslint-disable-next-line no-console
    runNewRender().catch(console.error);
  };
}

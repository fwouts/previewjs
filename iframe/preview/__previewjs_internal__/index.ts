import { overrideCopyCutPaste } from "./copy-cut-paste.js";
import { setUpLinkInterception } from "./links.js";
import { setUpLogInterception } from "./logs.js";
import { loadRenderer } from "./renderer/index.js";
import { runRenderer } from "./run-renderer.js";
import { setState } from "./state.js";
import { setupViteHmrListener } from "./vite-hmr-listener.js";

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
}) {
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

  return (updatedPreviewableModule: any, updatedWrapperModule: any) => {
    previewableModule = updatedPreviewableModule;
    wrapperModule = updatedWrapperModule;
    // eslint-disable-next-line no-console
    runNewRender().catch(console.error);
  };
}

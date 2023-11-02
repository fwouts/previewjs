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

function getRoot() {
  const root = document.getElementById("root")!;
  if (!root) {
    throw new Error(`Unable to find #root!`);
  }
  return root;
}

let lastGoodSnapshot = "";
export function revertToEarlierSnapshot() {
  const root = getRoot();
  if (root.innerHTML !== lastGoodSnapshot) {
    root.innerHTML = lastGoodSnapshot;
  }
}

function saveGoodSnapshot() {
  lastGoodSnapshot = getRoot().innerHTML;
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
  let renderId = 0;

  async function runNewRender({
    keepErrors = false,
  }: { keepErrors?: boolean } = {}) {
    saveGoodSnapshot();
    try {
      renderId += 1;
      const thisRenderId = renderId;
      await runRenderer({
        wrapperModule,
        wrapperName,
        previewableModule,
        previewableName,
        renderId,
        keepErrors,
        shouldAbortRender: () => renderId !== thisRenderId,
        loadRenderer,
      });
      saveGoodSnapshot();
    } catch (error: any) {
      revertToEarlierSnapshot();
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

  return (options) => {
    if (options.previewableModule) {
      previewableModule = options.previewableModule;
    }
    if (options.wrapperModule) {
      wrapperModule = options.wrapperModule;
    }
    // eslint-disable-next-line no-console
    runNewRender(options).catch(console.error);
  };
}

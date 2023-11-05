import type * as vite from "vite";

export type PreviewScriptOptions = {
  previewablePath: string;
  previewableName: string;
  wrapperPath: string | null;
  wrapperName: string | null;
  detectedGlobalCssFilePaths: string[];
};

const PATH_PREFIX = "/__previewjs_internal__/preview.js?p=";

export function previewScriptPlugin(): vite.Plugin {
  return {
    name: "previewjs:preview-script",
    load(id) {
      if (!id.startsWith(PATH_PREFIX)) {
        return;
      }
      const base64EncodedOptions = id.substring(PATH_PREFIX.length);
      const options: PreviewScriptOptions = JSON.parse(
        Buffer.from(base64EncodedOptions, "base64url").toString("utf8")
      );
      return previewScriptSource(options);
    },
  };
}

function previewScriptSource({
  previewablePath,
  previewableName,
  wrapperPath,
  wrapperName,
  detectedGlobalCssFilePaths,
}: PreviewScriptOptions) {
  return `
import { initListeners, initPreview } from "/__previewjs_internal__/index.ts";

initListeners();

import.meta.hot.accept();

let refresh = () => {};

window.__PREVIEWJS_IFRAME__.refresh = (options) => {
  refresh(options);
};

import.meta.hot.accept(["/${previewablePath}"], ([previewableModule]) => {
  if (previewableModule) {
    refresh({
      previewableModule,
    });
  }
});

${
  wrapperPath
    ? `
const wrapperModulePromise = import(/* @vite-ignore */ "/${wrapperPath}");
import.meta.hot.accept(["/${wrapperPath}"], ([wrapperModule]) => {
  if (wrapperModule) {
    refresh({
      wrapperModule,
    });
  }
});
`
    : `
const wrapperModulePromise = Promise.all([${detectedGlobalCssFilePaths
        .map(
          (cssFilePath) =>
            `import(/* @vite-ignore */ "/${cssFilePath.replace(
              /\\/g,
              "/"
            )}").catch(() => null)`
        )
        .join(",")}]).then(() => null);
`
}

// Important: the wrapper must be loaded first as it may monkey-patch
// modules imported by the component module.
wrapperModulePromise.then(wrapperModule => {
  import(/* @vite-ignore */ "/${previewablePath}").then(previewableModule => {
    refresh = initPreview({
      previewableModule,
      previewableName: ${JSON.stringify(previewableName)},
      wrapperModule,
      wrapperName: ${JSON.stringify(wrapperName)},
    });
  });
});
`;
}

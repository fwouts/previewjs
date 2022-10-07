import type { PreviewConfig } from "@previewjs/config";
import { URLSearchParams } from "url";
import type { Plugin } from "vite";

const COMPONENT_LOADER_MODULE = "/@component-loader.js";

type PluginOptions = {
  config: PreviewConfig;
  detectedGlobalCssFilePaths: string[];
};

export function componentLoaderPlugin(options: PluginOptions): Plugin {
  return {
    name: "previewjs:component-loader",
    resolveId: async function (id) {
      if (id.startsWith(COMPONENT_LOADER_MODULE)) {
        return id;
      }
      return null;
    },
    load: async function (id) {
      if (!id.startsWith(COMPONENT_LOADER_MODULE)) {
        return null;
      }
      const params = new URLSearchParams(id.split("?")[1] || "");
      return generateComponentLoaderModule(params, options);
    },
  };
}

function generateComponentLoaderModule(
  urlParams: URLSearchParams,
  { detectedGlobalCssFilePaths, config: { wrapper } }: PluginOptions
): string {
  const filePath = urlParams.get("p");
  const componentName = urlParams.get("c");
  if (filePath === null || componentName === null) {
    throw new Error(`Invalid use of /@component-loader.js module`);
  }
  const componentModuleId = `/${filePath.replace(/\\/g, "/")}`;
  return `import { updateComponent } from '/__previewjs_internal__/update-component';
import { load } from '/__previewjs_internal__/renderer/index';

let counter = 0;
export async function refresh() {
  const currentCounter = ++counter;
  let loadingError = null;
  ${
    wrapper
      ? `
  let wrapperModulePromise;
  if (import.meta.hot.data.preloadedWrapperModule) {
    wrapperModulePromise = Promise.resolve(import.meta.hot.data.preloadedWrapperModule);
  } else {
    wrapperModulePromise = import("/${wrapper.path}");
  }
  const wrapperModule = await wrapperModulePromise.catch(e => {
    console.error(e);
    loadingError = e.stack || e.message || null;
    return null;
  });
  `
      : `
  ${detectedGlobalCssFilePaths
    .map(
      (filePath) =>
        `import("/${filePath.replace(/\\/g, "/")}").catch(console.warn);`
    )
    .join("\n")}
  const wrapperModule = null;
  `
  }
  let componentModulePromise;
  if (import.meta.hot.data.preloadedComponentModule) {
    componentModulePromise = Promise.resolve(import.meta.hot.data.preloadedComponentModule);
  } else {
    componentModulePromise = import("${componentModuleId}");
  }
  const componentModule = await componentModulePromise.catch(e => {
    console.error(e);
    loadingError = e.stack || e.message || null;
    return null;
  });
  if (currentCounter !== counter) {
    // Abort to avoid double rendering.
    return;
  }
  await updateComponent({
    wrapperModule,
    wrapperName: ${JSON.stringify(wrapper?.componentName || null)},
    componentModule,
    componentFilePath: ${JSON.stringify(filePath)},
    componentName: ${JSON.stringify(componentName)},
    updateId: ${JSON.stringify(filePath)} + "-" + ${JSON.stringify(
    componentName
  )} + counter,
    loadingError,
    load,
  })
}

import.meta.hot.accept();

${
  wrapper
    ? `
import.meta.hot.accept(["${wrapper.path}"], ([wrapperModule]) => {
  if (wrapperModule) {
    import.meta.hot.data.preloadedWrapperModule = wrapperModule;
    refresh();
  }
});
`
    : ``
}

import.meta.hot.accept(["${componentModuleId}"], ([componentModule]) => {
  if (componentModule) {
    import.meta.hot.data.preloadedComponentModule = componentModule;
    refresh();
  }
});
`;
}

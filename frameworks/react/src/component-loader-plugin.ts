import type { PreviewConfig } from "@previewjs/config";
import { URLSearchParams } from "url";
import type { Plugin } from "vite";

const COMPONENT_LOADER_MODULE = "/@component-loader.jsx";

export function reactComponentLoaderPlugin(options: {
  config: PreviewConfig;
}): Plugin {
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
      return generateComponentLoaderModule(params, options.config.wrapper);
    },
  };
}

function generateComponentLoaderModule(
  urlParams: URLSearchParams,
  wrapper?: {
    path: string;
    componentName?: string;
  }
): string {
  const relativeFilePath = urlParams.get("p");
  const componentName = urlParams.get("c");
  if (relativeFilePath === null || componentName === null) {
    throw new Error(`Invalid use of /render module`);
  }
  const componentModuleId = `/${relativeFilePath.replace(/\\/g, "/")}`;
  return `import React from 'react';
import { sendMessageFromPreview } from '/__previewjs_internal__/messages';
import { updateComponent } from '/__previewjs_internal__/update-component';

export async function update() {
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
  const Wrapper = await wrapperModulePromise.then(module => {
    return module["${wrapper.componentName || "Wrapper"}"];
  }).catch(e => {
    console.error(e);
    loadingError = e.stack || e.message || null;
  }) || React.Fragment;
  `
      : `
  const Wrapper = React.Fragment;
  `
  }
  let componentModulePromise;
  if (import.meta.hot.data.preloadedComponentModule) {
    componentModulePromise = Promise.resolve(import.meta.hot.data.preloadedComponentModule);
  } else {
    componentModulePromise = import("${componentModuleId}");
  }
  const { Component, decorators } = await componentModulePromise.then((module) => {
    const Component = module["${
      componentName === "default" ? "default" : `__previewjs__${componentName}`
    }"];
    if (!Component) {
      throw new Error("No component named '${componentName}' could be found in ${relativeFilePath}");
    }
    return import.meta.hot.data.cached = {
      Component,
      decorators: [
        ...(Component.decorators || []),
        ...(module.default?.decorators || []),
      ],
    };
  }).catch(e => {
    console.error(e);
    loadingError = e.stack || e.message || null;
    return import.meta.hot.data.cached || {
      Component: () => <p>Oops! Something went wrong...</p>,
      decorators: [],
    };
  });
  const Decorated = decorators.reduce(
    (component, decorator) => () => decorator(component),
    Component
  );
  const variants = (Component.__previewjs_variants || []).map(
    (variant) => {
      return {
        key: variant.key,
        label: variant.label,
        isEditorDriven: false,
        props: variant.props,
      };
    });
  variants.push({
    key: "custom",
    label: "<${componentName} />",
    props: {},
    isEditorDriven: true,
  });
  return {
    componentInfo: {
      relativeFilePath: ${JSON.stringify(relativeFilePath)},
      componentName: ${JSON.stringify(componentName)},
      variants,
      Component: (props) => {
        return <Wrapper>
          <Decorated {...Component.args} {...props} />
        </Wrapper>
      },
    },
    loadingError
  };
}

import.meta.hot.accept();

function refresh() {
  updateComponent(update);
}

${
  wrapper
    ? `
import.meta.hot.accept(["${wrapper.path}"], ([wrapperModule]) => {
  import.meta.hot.data.preloadedWrapperModule = wrapperModule;
  refresh();
});
`
    : ``
}

import.meta.hot.accept(["${componentModuleId}"], ([componentModule]) => {
  import.meta.hot.data.preloadedComponentModule = componentModule;
  refresh();
});
`;
}

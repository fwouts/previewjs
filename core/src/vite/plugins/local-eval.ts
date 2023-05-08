import path from "path";
import type * as vite from "vite";

export function localEval(): vite.Plugin {
  return {
    name: "previewjs:local-eval",
    enforce: "post",
    transform: (code, id) => {
      if (id.indexOf(`/node_modules/`) !== -1) {
        return null;
      }
      if (id.indexOf("?") !== -1 || id.endsWith(".html")) {
        // Example: .../src/App.vue?vue&type=style&index=0&lang.css
        return null;
      }
      // TODO: Test this out with Vue files that have hyphens.
      const baseName = path.basename(id, path.extname(id));
      // TODO: Is this really the right approach? The problem is that Vue and Svelte
      // name the component "App" for "App.vue" when it's actually imported as "default".
      let localDefaultExportHack = "";
      if (baseName.match(/^[a-zA-Z][a-zA-Z0-9_]*$/)) {
        localDefaultExportHack = `
          let ${baseName};
          try {
            ${baseName} = pjs_defaultExport;
          } catch {
            // Ignore.
          }
        `;
      }
      return (
        code +
        // Note: This is an uppercase function so that it "looks like" a React component.
        // This needed to prevent breaking React Refresh, which expects all exports to
        // be React components.
        `
export const PreviewJsEvaluateLocally = async (autogenCallbackPropsSource, propsAssignmentSource, __jsxFactory__) => {
  ${localDefaultExportHack}
  let autogenCallbackProps = {};
  eval(autogenCallbackPropsSource);
  let properties = {};
  eval(propsAssignmentSource);
  return { autogenCallbackProps, properties };
}
`
      );
    },
  };
}

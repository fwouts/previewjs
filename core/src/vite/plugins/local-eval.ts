import type * as vite from "vite";

export function localEval(): vite.Plugin {
  return {
    name: "previewjs:local-eval",
    enforce: "post",
    transform: (code, id) => {
      if (id.indexOf(`/node_modules/`) !== -1) {
        return null;
      }
      if (id.indexOf("?") !== -1) {
        // Example: .../src/App.vue?vue&type=style&index=0&lang.css
        return null;
      }
      return (
        code +
        // Note: This is an uppercase function so that it "looks like" a React component.
        // This needed to prevent breaking React Refresh, which expects all exports to
        // be React components.
        `
export const PreviewJsEvaluateLocally = async (autogenCallbackPropsSource, propsAssignmentSource) => {
  let autogenCallbackProps = {};
  eval(\`autogenCallbackProps = \${autogenCallbackPropsSource};\`);
  let properties = {};
  eval(\`\${propsAssignmentSource};\`);
  return { autogenCallbackProps, properties };
}
`
      );
    },
  };
}

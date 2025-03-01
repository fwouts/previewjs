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
        return null;
      }
      return (
        code +
        // Note: This is an uppercase function so that it "looks like" a React component.
        // This needed to prevent breaking React Refresh, which expects all exports to
        // be React components.
        `
export const PreviewJsEval = (code, args = {}) => {
  return eval("(({ " + Object.keys(args).join(", ") +  "}) => { " + code + " })(args)");
}
`
      );
    },
  };
}

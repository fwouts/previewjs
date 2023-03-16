import type * as vite from "vite";

export function localEval(): vite.Plugin {
  return {
    name: "previewjs:local-eval",
    transform: (code, id) => {
      const params = new URLSearchParams(id.split("?")[1] || "");
      if (params.get("local_eval") !== "1") {
        return;
      }
      return (
        code +
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

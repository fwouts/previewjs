import type * as vite from "vite";

export function embedPropsAssignmentSource(): vite.Plugin {
  return {
    name: "previewjs:embed-invocation-source",
    transform: (code, id) => {
      // TODO: Only do this if a specific query param is there?
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

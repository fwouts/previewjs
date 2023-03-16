import type * as vite from "vite";

export function embedPropsAssignmentSource(): vite.Plugin {
  return {
    name: "previewjs:embed-invocation-source",
    transform: (code, id) => {
      const urlParams = new URLSearchParams(id.split("?")[1] || "");
      const autogenCallbackPropsSource = urlParams.get("a");
      const propsAssignmentSource = urlParams.get("s");
      if (!autogenCallbackPropsSource || !propsAssignmentSource) {
        return;
      }
      return (
        code +
        `
export const PreviewJsProps = () => {
  const autogenCallbackProps = ${autogenCallbackPropsSource};
  const ${propsAssignmentSource};
  return { autogenCallbackProps, properties };
}
`
      );
    },
  };
}

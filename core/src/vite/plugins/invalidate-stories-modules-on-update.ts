import type * as vite from "vite";

export function invalidateStoriesModulesOnUpdate(): vite.Plugin {
  return {
    name: "previewjs:invalidate-stories-modules-on-update",
    enforce: "post",
    transform: (code) => {
      if (!code.includes("import.meta.hot.accept(")) {
        return null;
      }
      return `${code}
if (import.meta?.hot) {
  import.meta.hot.accept(newModule => {
    if (newModule?.default?.component) {
      import.meta.hot.invalidate();
    }
  });
}
`;
    },
  };
}

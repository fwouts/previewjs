/** @type {import("@previewjs/config").PreviewConfig} */
module.exports = {
  // Aliasing of paths to directories.
  //
  // Note: tsconfig.json path aliases are automatically detected, they can be omitted.
  alias: {
    // app: "src",
  },

  // Public assets directory.
  publicDir: "public",

  // Wrapper file configuration.
  wrapper: {
    path: "__previewjs__/Wrapper.tsx",
    componentName: "Wrapper",
  },

  vite: {
    css: {
      preprocessorOptions: {
        less: {
          javascriptEnabled: true,
        },
      },
    },
  },
};

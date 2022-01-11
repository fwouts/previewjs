const { vanillaExtractPlugin } = require("@vanilla-extract/vite-plugin");

/** @type {import("@previewjs/config").PreviewConfig} */
module.exports = {
  vite: {
    plugins: [vanillaExtractPlugin()],
  },
};

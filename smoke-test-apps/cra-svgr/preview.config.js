const { svgr } = require("vite-plugin-react-svgr");

/** @type {import("@previewjs/config").PreviewConfig} */
module.exports = {
  vite: {
    plugins: [
      svgr({
        exportAs: "ReactComponent",
      }),
    ],
  },
};

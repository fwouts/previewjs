const { svgr } = require("vite-plugin-react-svgr");

/** @type {import("@previewjs/config").PreviewConfig} */
module.exports = {
  alias: {
    button2: "./src/components/Button",
  },
  vite: {
    plugins: [
      svgr({
        exportAs: "ReactComponent",
      }),
    ],
  },
};

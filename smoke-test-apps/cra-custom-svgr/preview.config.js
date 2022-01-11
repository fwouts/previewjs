const { reactFrameworkPlugin } = require("@previewjs/plugin-react");

/** @type {import("@previewjs/config").PreviewConfig} */
module.exports = {
  frameworkPlugin: reactFrameworkPlugin.create({
    svgr: {
      componentName: "default",
    },
  }),
};

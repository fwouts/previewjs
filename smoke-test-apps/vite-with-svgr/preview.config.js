const svgr = require("vite-plugin-svgr").default;

module.exports = {
  vite: {
    plugins: [svgr()],
  },
};

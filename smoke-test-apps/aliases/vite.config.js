import { svgr } from "vite-plugin-react-svgr";

/** @type {import('vite').UserConfig} */
export default {
  resolve: {
    alias: [
      {
        find: /button2/,
        replacement: "./src/components/Button",
      },
    ],
  },
  plugins: [
    svgr({
      exportAs: "ReactComponent",
    }),
  ],
};

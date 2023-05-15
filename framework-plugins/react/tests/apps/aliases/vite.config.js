import path from "path";
import { svgr } from "vite-plugin-react-svgr";

/** @type {import('vite').UserConfig} */
export default {
  resolve: {
    alias: [
      {
        find: /button2/,
        replacement: path.resolve(__dirname, "src/components/Button"),
      },
    ],
  },
  plugins: [
    svgr({
      exportAs: "ReactComponent",
    }),
  ],
};

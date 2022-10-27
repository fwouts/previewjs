import { svgr } from "vite-plugin-react-svgr";

export default {
  resolve: {
    alias: {
      button2: "./src/components/Button",
    },
  },
  plugins: [
    svgr({
      exportAs: "ReactComponent",
    }),
  ],
};

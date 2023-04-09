import { svgr } from "vite-plugin-react-svgr";

export default {
  plugins: [
    svgr({
      exportAs: "ReactComponent",
    }),
  ],
};

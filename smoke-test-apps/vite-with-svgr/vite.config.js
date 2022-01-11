import reactPlugin from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

export default {
  plugins: [reactPlugin(), svgr()],
};

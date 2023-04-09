import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import reactPlugin from "@vitejs/plugin-react";

export default {
  plugins: [reactPlugin(), vanillaExtractPlugin()],
  base: "/preview/",
};

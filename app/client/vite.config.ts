import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgrPlugin from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), svgrPlugin()],
  server: {
    cors: {
      origin: null,
    },
    proxy: {
      "^/(api|monaco-editor|preview|__previewjs_internal__)/.*": {
        target: "http://localhost:8120",
        changeOrigin: true,
      },
    },
  },
  build: {
    commonjsOptions: {
      include: [/core\/.*/, /node_modules/],
    },
  },
});

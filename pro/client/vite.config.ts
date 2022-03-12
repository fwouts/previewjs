import reactPlugin from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";
import svgrPlugin from "vite-plugin-svgr";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [reactPlugin(), svgrPlugin()],
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
  optimizeDeps: {
    include: ["@previewjs/api"],
  },
  build: {
    commonjsOptions: {
      include: [/api\/.*/, /node_modules/],
    },
  },
  resolve: {
    alias: {
      "@previewjs/pro-api": path.resolve(__dirname, "../src/api"),
    },
  },
});

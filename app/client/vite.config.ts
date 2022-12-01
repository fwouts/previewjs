import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    cors: {
      origin: null,
    },
    proxy: {
      "^/(api|preview|__previewjs_internal__)/.*": {
        target: "http://localhost:8120",
        changeOrigin: true,
      },
    },
  },
  optimizeDeps: {
    disabled: false,
  },
  build: {
    commonjsOptions: { include: [] },
  },
});

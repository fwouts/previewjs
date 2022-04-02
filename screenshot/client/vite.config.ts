import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "^/(preview|__previewjs_internal__)/.*": {
        target: "http://localhost:3250",
        changeOrigin: true,
      },
    },
  },
});

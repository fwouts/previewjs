import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      globby: "./polyfills/globby.js",
    },
  },
});

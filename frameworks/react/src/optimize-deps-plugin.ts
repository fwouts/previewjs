import type { Plugin } from "vite";

export function optimizeReactDepsPlugin(): Plugin {
  return {
    name: "optimize-deps",
    config: () => ({
      optimizeDeps: {
        include: ["react", "react-dom"],
      },
    }),
  };
}

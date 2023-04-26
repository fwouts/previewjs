import type { Plugin } from "vite";

export function optimizeSolidDepsPlugin(): Plugin {
  return {
    name: "optimize-deps",
    config: () => ({
      optimizeDeps: {
        include: ["solid-js"],
      },
    }),
  };
}

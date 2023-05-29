import type { RendererLoader } from "../../../src";

export const load: RendererLoader = () => {
  // This is a dummy function that is replaced by
  // a framework-specific implementation at runtime.
  throw new Error("Dummy loader was invoked!");
};

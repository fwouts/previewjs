import type { JsxElementMounter, RendererLoader } from "../../../src";

export const loadRenderer: RendererLoader = () => {
  // This is a dummy function that is replaced by
  // a framework-specific implementation at runtime.
  throw new Error("Dummy loader was invoked!");
};

export const jsxFactory = () => {
  throw new Error("Dummy jsxFactory was invoked!");
};

export const mount: JsxElementMounter = async () => {
  // This is a dummy function that is replaced by
  // a framework-specific implementation at runtime.
  throw new Error("Dummy mount was invoked!");
};

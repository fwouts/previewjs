import React from "react";
import { createRoot, Root } from "react-dom/client";

let root: Root;
export function render<P>(Renderer: React.ComponentType<P>, props: P) {
  const container = document.getElementById("root");
  if (!Renderer) {
    if (root) {
      root.unmount();
      root = null;
    }
    return;
  }
  if (!root) {
    root = createRoot(container);
  }
  root.render(<Renderer {...props} />);
}

import React from "react";
import { createRoot, Root } from "react-dom/client";
import { rootContainer } from "./root";

let root: Root | null = null;
export function render(Renderer: React.ComponentType, props: any) {
  if (!Renderer) {
    if (root) {
      root.unmount();
      root = null;
    }
    return;
  }
  if (!root) {
    root = createRoot(rootContainer);
  }
  root.render(<Renderer {...props} />);
}

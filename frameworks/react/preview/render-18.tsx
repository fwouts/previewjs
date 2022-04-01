import React from "react";
import { createRoot, Root } from "react-dom/client";
import { ErrorBoundary } from "./ErrorBoundary";

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
  const element = // Ensure we get a fresh ErrorBoundary.
    (
      <ErrorBoundary key={Date.now()}>
        <Renderer {...props} />
      </ErrorBoundary>
    );
  if (!root) {
    root = createRoot(container);
  }
  root.render(element);
}

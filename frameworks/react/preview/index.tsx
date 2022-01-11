import React from "react";
import ReactDOM from "react-dom";
import { ErrorBoundary } from "./ErrorBoundary";

let root: any;
export function render<P>(Renderer: React.ComponentType<P>, props: P) {
  const container = document.getElementById("root");
  if (!Renderer) {
    if (root) {
      root.unmount();
      root = null;
    } else {
      ReactDOM.unmountComponentAtNode(container);
    }
    return;
  }
  if ("createRoot" in ReactDOM && !root) {
    // React 18 API.
    // See https://github.com/reactwg/react-18/discussions/6.
    root = (ReactDOM as any).createRoot(container);
  }
  const element = ( // Ensure we get a fresh ErrorBoundary.
    <ErrorBoundary key={Date.now()}>
      <Renderer {...props} />
    </ErrorBoundary>
  );
  if (root) {
    root.render(element);
  } else {
    ReactDOM.render(element, container);
  }
}

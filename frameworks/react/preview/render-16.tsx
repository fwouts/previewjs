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
  const element = // Ensure we get a fresh ErrorBoundary.
    (
      <ErrorBoundary key={Date.now()}>
        <Renderer {...props} />
      </ErrorBoundary>
    );
  ReactDOM.render(element, container);
}

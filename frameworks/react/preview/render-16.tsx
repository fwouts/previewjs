import React from "react";
import ReactDOM from "react-dom";

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
  ReactDOM.render(<Renderer {...props} />, container);
}

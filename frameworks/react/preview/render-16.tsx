import React from "react";
import ReactDOM from "react-dom";

export function render<P>(Renderer: React.ComponentType<P>, props: P) {
  const container = document.getElementById("root");
  if (!Renderer) {
    ReactDOM.unmountComponentAtNode(container);
    return;
  }
  ReactDOM.render(<Renderer {...props} />, container);
}

import React from "react";
import ReactDOM from "react-dom";

export function render(Renderer: React.ComponentType, props: any) {
  const container = document.getElementById("root")!;
  if (!Renderer) {
    ReactDOM.unmountComponentAtNode(container);
    return;
  }
  ReactDOM.render(<Renderer {...props} />, container);
}

import React from "react";
import ReactDOM from "react-dom";
import { rootContainer } from "./root";

export function render(Renderer: React.ComponentType, props: any) {
  if (!Renderer) {
    ReactDOM.unmountComponentAtNode(rootContainer);
    return;
  }
  ReactDOM.render(<Renderer {...props} />, rootContainer);
}

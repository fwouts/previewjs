import ReactDOM from "react-dom";
import { rootContainer } from "./root.js";

export function render(node: JSX.Element) {
  ReactDOM.render(node, rootContainer);
}

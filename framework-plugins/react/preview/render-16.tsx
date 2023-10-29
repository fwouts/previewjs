import ReactDOM from "react-dom";
import { rootContainer } from "./root";

export function render(node: JSX.Element) {
  ReactDOM.render(node, rootContainer);
}

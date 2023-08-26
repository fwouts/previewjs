import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import { rootContainer } from "./root";

let root: Root | null = null;
export function render(node: JSX.Element) {
  if (!root) {
    root = createRoot(rootContainer);
  }
  root.render(node);
}

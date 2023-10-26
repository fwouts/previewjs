import type { RenderOptions } from "../../src/index.js";

let state: RenderOptions | null = null;

export function getState() {
  return state;
}

export function setState(newState: RenderOptions) {
  state = newState;
}

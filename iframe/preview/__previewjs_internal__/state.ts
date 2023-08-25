import type { RenderOptions } from "../../src";

let state: RenderOptions | null = null;

export function getState() {
  return state;
}

export function setState(newState: RenderOptions) {
  state = newState;
}

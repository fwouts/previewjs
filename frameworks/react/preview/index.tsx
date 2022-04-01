import React from "react";
// @ts-ignore Vite is fine with this
import { version } from "react/package.json";

const moduleName = parseInt(version) >= 18 ? "./render-18" : "./render-16";

export async function render<P>(Renderer: React.ComponentType<P>, props: P) {
  const { render } = await import(/* @vite-ignore */ moduleName);
  return render(Renderer, props);
}

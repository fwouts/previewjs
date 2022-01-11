// @ts-ignore
import * as vueOptions from "@previewjs/plugin-vue2/options";
import Vue from "vue";

const root = document.getElementById("root");
let app: Vue | null = null;
// TODO: Type Renderer properly.
export function render<P>(Renderer: any, props: P) {
  if (app) {
    app.$destroy();
    app = null;
  }
  if (!Renderer) {
    return;
  }
  if (Renderer.functional) {
    Renderer = Renderer.render;
  }
  app = new Vue({
    ...vueOptions,
    render: (h) => Renderer(h, props),
  }).$mount();
  while (root.firstChild) {
    root.removeChild(root.firstChild);
  }
  root.appendChild(app.$el);
}

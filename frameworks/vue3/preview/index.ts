import { App, createApp, DefineComponent } from "vue";

let app: App | null = null;
export async function render<P extends Record<string, unknown>>(
  Renderer: DefineComponent<P, {}, any>,
  props: P
) {
  if (app) {
    app.unmount();
    app = null;
  }
  if (!Renderer) {
    return;
  }
  app = createApp(Renderer, props || {});
  app.mount("#root");
}

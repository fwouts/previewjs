import { render as preactRender, ComponentType } from 'preact';

export function render<P>(Renderer: ComponentType<P>, props: P) {
  const container = document.getElementById('root');
  if (!Renderer) {
    preactRender(null, container);
  } else {
    preactRender(<Renderer {...props} />, container);
  }
}
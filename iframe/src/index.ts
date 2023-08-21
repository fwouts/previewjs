declare global {
  interface Window {
    __PREVIEWJS__: {
      render(options: RenderOptions): Promise<void>;
    };
  }
}

export interface RenderOptions {
  autogenCallbackPropsSource: string;
  propsAssignmentSource: string;
}

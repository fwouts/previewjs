declare global {
  interface Window {
    __previewjs_navigate(componentId: string): void;
  }
}

export {};

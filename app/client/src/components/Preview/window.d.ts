declare global {
  interface Window {
    __previewjs_navigate(componentId: string, variantKey?: string | null): void;
  }
}

export {};

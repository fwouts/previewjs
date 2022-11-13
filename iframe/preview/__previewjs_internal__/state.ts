let state: PreviewState | null = null;

export function getState() {
  return state;
}

export function setState(newState: PreviewState) {
  state = newState;
}

export interface PreviewState {
  filePath: string;
  componentName: string;
  defaultPropsSource: string;
  propsAssignmentSource: string;
  // Note: `null` means "first available preset variant, or fall back to custom".
  variantKey: string | null;
}

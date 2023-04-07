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
  autogenCallbackPropsSource: string;
  propsAssignmentSource: string;
}

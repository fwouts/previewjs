let state: PreviewState | null = null;

export function getState() {
  return state;
}

export function setState(newState: PreviewState) {
  state = newState;
}

export interface PreviewState {
  autogenCallbackPropsSource: string;
  propsAssignmentSource: string;
}

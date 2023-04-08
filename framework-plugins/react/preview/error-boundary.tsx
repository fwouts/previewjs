import { Component, ReactNode } from "react";

type ErrorBoundaryProps = {
  renderId: number;
  children: ReactNode;
};

let errorBoundaryInstance: ErrorBoundary | null = null;

export async function expectErrorBoundary(
  renderId: number,
  shouldAbortRender: () => boolean
) {
  while (
    !errorBoundaryInstance ||
    errorBoundaryInstance.props.renderId !== renderId
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (shouldAbortRender()) {
      return null;
    }
  }
  return errorBoundaryInstance;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps> {
  state = {
    error: null as Error | null,
  };

  constructor(props: ErrorBoundaryProps) {
    super(props);
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    errorBoundaryInstance = this;
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return <></>;
    }

    return this.props.children;
  }
}

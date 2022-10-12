import { Component, ReactNode } from "react";

type ErrorBoundaryProps = {
  updateId: string;
  children: ReactNode;
};

let errorBoundaryInstance: ErrorBoundary | null = null;

export async function expectErrorBoundary(
  updateId: string,
  getCurrentUpdateId: () => string
) {
  while (
    !errorBoundaryInstance ||
    errorBoundaryInstance.props.updateId !== updateId
  ) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    if (getCurrentUpdateId() !== updateId) {
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

  componentDidCatch(_error, _errorInfo) {
    // Do nothing, it will be shown already in the logs.
  }

  render() {
    if (this.state.error) {
      return <h1>Something went wrong.</h1>;
    }

    return this.props.children;
  }
}

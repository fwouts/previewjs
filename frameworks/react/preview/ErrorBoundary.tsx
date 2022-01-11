import React from "react";
// @ts-ignore
import { sendMessageFromPreview } from "/__previewjs_internal__/messages";

const DEFAULT_STATE = {
  hasError: false,
} as const;

let lastError: Error | null;

export class ErrorBoundary extends React.Component<
  {},
  {
    hasError: boolean;
  }
> {
  constructor(props: {}) {
    super(props);
    lastError = null;
    this.state = DEFAULT_STATE;
  }

  static getDerivedStateFromError(error: Error, _errorInfo: React.ErrorInfo) {
    lastError = error;
    return { hasError: true };
  }

  componentDidMount() {
    this.afterRender();
  }

  componentDidUpdate() {
    this.afterRender();
  }

  private afterRender() {
    if (this.state.hasError) {
      if (!lastError) {
        throw new Error(`Error could not be found!`);
      }
      const errorMessage = [
        ...new Set(
          `Error: ${lastError.message}\n${lastError.stack}`
            .split("\n")
            .filter(Boolean)
        ),
      ].join("\n");
      sendMessageFromPreview({
        kind: "rendering-error",
        message: errorMessage,
      });
    }
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

import { PreviewUpdate } from "@previewjs/core/controller";
import { makeAutoObservable, runInAction } from "mobx";
import React from "react";

const DELAYED_ERROR_MILLIS = 1000;

export class ErrorState {
  error: ErrorDetails | null = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private delayedErrorTimeoutHandle: any = null;

  constructor() {
    makeAutoObservable(this);
  }

  update(event: PreviewUpdate) {
    const viteError = event.viteError;
    if (viteError) {
      const message = viteError.err.message;
      const lineBreakPosition = message.indexOf("\n");
      let title: string;
      let rest: string;
      if (lineBreakPosition > -1) {
        title = message.substr(0, lineBreakPosition).trim();
        rest = message.substr(lineBreakPosition + 1);
      } else {
        title = message;
        rest = "";
      }
      if (viteError.err.stack) {
        rest += `\n${viteError.err.stack}`;
      }
      // Remove any leading line breaks (but not spaces,
      // which could be useful indentation).
      rest = rest.replace(/^\n*/g, "");
      const stripPrefix = "Internal server error: ";
      if (title.startsWith(stripPrefix)) {
        title = title.substr(stripPrefix.length);
      }
      if (title.endsWith(":") || title.endsWith(".")) {
        title = title.substr(0, title.length - 1).trim();
      }
      // Note: this isn't relevant to all browsers.
      if (rest.startsWith(`Error: ${title}\n`)) {
        rest = rest.substr(rest.indexOf("\n") + 1);
      }
      this.setErrorWithDelay({
        title,
        details: (viteError.err.loc?.file || rest) && (
          <>
            {viteError.err.loc?.file && (
              <b>{`Error in ${viteError.err.loc.file}:${viteError.err.loc.line}:${viteError.err.loc.column}\n\n`}</b>
            )}
            {rest}
          </>
        ),
      });
    } else if (event.rendering?.kind === "error") {
      const message = event.rendering.error;
      const [title, ...rest] = message.split("\n");
      this.setErrorWithDelay({
        title: title || "An unknown error has occurred",
        details: rest.length > 0 && rest.join("\n"),
      });
    } else {
      this.setErrorWithDelay(null);
    }
  }

  get suggestion():
    | {
        message: string;
        url?: string;
      }
    | undefined {
    const error = this.error;
    if (!error) {
      return;
    }
    if (error.title?.startsWith(`Failed to resolve import `)) {
      return {
        message: "Show me how to configure aliases",
        url: "https://previewjs.com/docs/config/aliases",
      };
    } else if (
      error.title?.includes("Failed to execute 'createElement'") &&
      error.title?.includes(".svg")
    ) {
      return {
        message: "Help me set up SVGR",
        url: "https://previewjs.com/docs/config/svgr",
      };
    } else if (error.title?.includes("Could not resolve")) {
      const match = error.title.match(
        /Could not resolve "((@[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+)|[a-zA-Z0-9-]+)/
      );
      return {
        message: match
          ? `Perhaps you need to install ${match[1]}?`
          : "Perhaps you need to install a peer dependency?",
      };
    }
    return;
  }

  private setErrorWithDelay(error: ErrorDetails | null) {
    if (this.delayedErrorTimeoutHandle) {
      clearTimeout(this.delayedErrorTimeoutHandle);
      this.delayedErrorTimeoutHandle = null;
    }
    if (!error) {
      this.error = null;
    } else {
      this.delayedErrorTimeoutHandle = setTimeout(() => {
        runInAction(() => {
          this.error = error;
          this.delayedErrorTimeoutHandle = null;
        });
      }, DELAYED_ERROR_MILLIS);
    }
  }
}

interface ErrorDetails {
  title: string;
  details?: React.ReactNode;
}

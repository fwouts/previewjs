import { LogLevel, LogMessage } from "@previewjs/iframe";
import { makeAutoObservable } from "mobx";

export interface LogMessageWithSuggestion extends LogMessage {
  suggestion?: Suggestion;
}

type Suggestion = {
  message: string;
  url: string;
};

export class ConsolePanelState {
  logs: LogMessageWithSuggestion[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  onConsoleMessage(event: LogMessage) {
    if (
      this.logs.find(
        (log) =>
          event.level === log.level &&
          event.message === log.message &&
          Math.abs(event.timestamp - log.timestamp) < 1000
      )
    ) {
      // Don't show the same log message twice in a row within a second.
      return;
    }
    this.logs.push({
      ...event,
      suggestion: generateSuggestion(event.message),
    });
  }

  onClear() {
    this.logs = [];
  }

  get unreadCount() {
    return this.logs.filter((message) => isNotifiable(message.level)).length;
  }
}

function isNotifiable(level: LogLevel) {
  switch (level) {
    case "warn":
    case "error":
      return true;
    default:
      return false;
  }
}

function generateSuggestion(message: string): Suggestion | undefined {
  if (message.includes(`Failed to resolve import `)) {
    const match = message.match(
      /Failed to resolve import "((@[a-zA-Z0-9\\-]+\/[a-zA-Z0-9\\-]+)|[a-zA-Z0-9\\-]+)"/
    );
    const url = "https://previewjs.com/docs/config/aliases";
    return {
      message: match
        ? `Perhaps you need to install "${match[1]}" or configure aliases? See ${url}`
        : "Perhaps you need to install a peer dependency or configure aliases? See ${url}",
      url,
    };
  }
  if (message.includes(".svg?import")) {
    const url = "https://previewjs.com/docs/config/svgr";
    return {
      message: `Read ${url} to configure SVGR for your project.`,
      url,
    };
  }
  return undefined;
}

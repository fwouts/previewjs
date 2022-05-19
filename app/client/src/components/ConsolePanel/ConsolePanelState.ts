import { LogLevel, LogMessage } from "@previewjs/core/controller";
import { makeAutoObservable } from "mobx";

export class ConsolePanelState {
  logs: LogMessage[] = [];

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
    this.logs.push(event);
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

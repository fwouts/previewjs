import { LogLevel, LogMessage } from "@previewjs/core/controller";
import { makeAutoObservable } from "mobx";

export class ConsolePanelState {
  logs: LogMessage[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  onConsoleMessage(event: LogMessage) {
    const lastLoggedMessage = this.logs.at(-1);
    if (
      lastLoggedMessage &&
      event.level === lastLoggedMessage.level &&
      event.message === lastLoggedMessage.message &&
      event.timestamp - lastLoggedMessage.timestamp < 1000
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

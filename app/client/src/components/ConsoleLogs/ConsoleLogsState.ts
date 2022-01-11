import { LogLevel, LogMessage } from "@previewjs/core/controller";
import { makeAutoObservable } from "mobx";

export class ConsoleLogsState {
  logs: LogMessage[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  onConsoleMessage(event: LogMessage) {
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

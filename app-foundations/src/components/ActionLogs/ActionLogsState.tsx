import type { Action } from "@previewjs/iframe";
import { makeAutoObservable } from "mobx";

export class ActionLogsState {
  logs: Item[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  onAction(action: Action): void {
    const key = `${Date.now()}-${action.type}-${action.path}`;
    const existingActionLog = this.logs.find(
      (a) => a.action.path === action.path
    );
    if (existingActionLog) {
      existingActionLog.count += 1;
    } else {
      const item: Item = {
        key,
        action,
        count: 1,
        remove: () => this.removeItem(item),
      };
      this.logs.push(item);
    }
  }

  private removeItem(item: Item) {
    this.logs = this.logs.filter((a) => a.key !== item.key);
  }
}

export type Item = {
  key: string;
  action: Action;
  count: number;
  remove(): void;
};

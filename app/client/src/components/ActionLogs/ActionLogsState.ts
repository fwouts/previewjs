import { Action } from "@previewjs/core/controller";
import { makeAutoObservable } from "mobx";
import { ActionLogProps } from "./ActionLogProps";

export class ActionLogsState {
  logs: ActionLogProps[] = [];

  constructor() {
    makeAutoObservable(this);
  }

  onAction(action: Action): void {
    const now = Date.now();
    const key = now.toString();
    const existingActionLog = this.logs.find(
      (a) => a.action.path === action.path
    );
    if (existingActionLog) {
      existingActionLog.count += 1;
      existingActionLog.timestamp = now;
    } else {
      this.logs.push({
        key,
        action,
        count: 1,
        timestamp: now,
        onAnimationComplete: () => {
          this.logs = this.logs.filter((a) => a.key !== key);
        },
      });
    }
  }
}

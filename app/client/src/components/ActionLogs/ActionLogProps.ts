import { Action } from "@previewjs/core/controller";

export interface ActionLogProps {
  key: string;
  action: Action;
  count: number;
  timestamp: number;
  onAnimationComplete(): void;
}

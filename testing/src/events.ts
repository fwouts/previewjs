import type { LogMessage, PreviewEvent } from "@previewjs/iframe";
import { inspect } from "util";

export function expectLoggedMessages(events: PreviewEvent[]) {
  return {
    toMatch: (messages: string[], level = "error") => {
      const logEvents = events.filter(
        (e) => e.kind === "log-message" && (!level || e.level === level)
      ) as LogMessage[];
      const remainingLogEvents = [...logEvents];
      for (const message of messages) {
        let found = false;
        for (let i = 0; i < remainingLogEvents.length; i++) {
          if (remainingLogEvents[i]?.message.includes(message)) {
            remainingLogEvents.splice(i, 1);
            found = true;
            break;
          }
        }
        if (!found) {
          throw new Error(
            `Unable to find logged message: "${message}".\nReceived: ${inspect(
              logEvents
            )}`
          );
        }
      }
      if (remainingLogEvents.length > 0) {
        throw new Error(
          `Encountered unexpected logged messages.\nUnmatched: ${inspect(
            remainingLogEvents
          )}`
        );
      }
    },
  };
}

export type LoggedMessagesMatcher = {
  toMatch: (messages: string[], level?: string) => void;
};

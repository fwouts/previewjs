import type { LogMessage, PreviewEvent } from "@previewjs/iframe";
import { inspect } from "util";

export function expectLoggedMessages(events: PreviewEvent[]) {
  return {
    toMatch: async (
      messages: string[],
      level = "error",
      retrying = false
    ): Promise<void> => {
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
          if (retrying) {
            throw new Error(
              `Unable to find logged message: "${message}".\nReceived: ${inspect(
                logEvents
              )}`
            );
          } else {
            console.warn(
              `Unable to find logged message immediately: "${message}".\n\nRetrying in five seconds...`
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return expectLoggedMessages(events).toMatch(messages, level, true);
          }
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

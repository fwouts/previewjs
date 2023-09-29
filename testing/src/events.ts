import type {
  LogLevel,
  LogMessage,
  PreviewError,
  PreviewEvent,
} from "@previewjs/iframe";
import { inspect } from "util";

export function expectErrors(events: PreviewEvent[]) {
  return {
    toMatch: async (
      messages: Array<string | string[]>,
      retrying = false
    ): Promise<void> => {
      let errorEvents: PreviewError[] = [];
      for (const event of events) {
        switch (event.kind) {
          case "bootstrapped":
          case "vite-before-update":
            errorEvents = [];
            break;
          case "error":
            errorEvents.push(event);
            break;
        }
      }
      const remainingErrorEvents = [...errorEvents];
      for (const message of messages) {
        const messageCandidates = Array.isArray(message) ? message : [message];
        let found = false;
        eventLoop: for (let i = 0; i < remainingErrorEvents.length; i++) {
          for (const candidate of messageCandidates) {
            if (remainingErrorEvents[i]?.message.includes(candidate)) {
              remainingErrorEvents.splice(i, 1);
              found = true;
              break eventLoop;
            }
          }
        }
        if (!found) {
          if (retrying) {
            throw new Error(
              `Unable to find error: "${message}".\nReceived: ${inspect(
                errorEvents
              )}`
            );
          } else {
            // eslint-disable-next-line no-console
            console.warn(
              `Unable to find error immediately: "${message}".\n\nRetrying in five seconds...`
            );
            await new Promise((resolve) => setTimeout(resolve, 5000));
            return expectErrors(events).toMatch(messages, true);
          }
        }
      }
      if (remainingErrorEvents.length > 0) {
        throw new Error(
          `Encountered unexpected errors.\nUnmatched: ${inspect(
            remainingErrorEvents
          )}\n\nFull list: ${inspect(errorEvents)}`
        );
      }
    },
  };
}

export function expectLoggedMessages(events: PreviewEvent[]) {
  return {
    toMatch: async (
      messages: Array<string | string[]>,
      level = "error",
      retrying = false
    ): Promise<void> => {
      let logEvents: LogMessage[] = [];
      for (const event of events) {
        switch (event.kind) {
          case "bootstrapped":
          case "vite-before-update":
            logEvents = [];
            break;
          case "log-message":
            if (!level || event.level === level) {
              logEvents.push(event);
            }
            break;
        }
      }
      const remainingLogEvents = [...logEvents];
      for (const message of messages) {
        const messageCandidates = Array.isArray(message) ? message : [message];
        let found = false;
        eventLoop: for (let i = 0; i < remainingLogEvents.length; i++) {
          for (const candidate of messageCandidates) {
            if (remainingLogEvents[i]?.message.includes(candidate)) {
              remainingLogEvents.splice(i, 1);
              found = true;
              break eventLoop;
            }
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
            // eslint-disable-next-line no-console
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
          )}\n\nFull list: ${inspect(logEvents)}`
        );
      }
    },
  };
}

export type ErrorsMatcher = {
  toMatch: (messages: Array<string | string[]>) => void;
};

export type LoggedMessagesMatcher = {
  toMatch: (messages: Array<string | string[]>, level?: LogLevel) => void;
};

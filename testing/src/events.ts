import type { LogLevel, PreviewIframeState } from "@previewjs/iframe";
import { inspect } from "util";

const RETRY_AFTER_MILLIS = 100;
const MAX_RETRIES = 50;

export function expectErrors(getState: () => PreviewIframeState) {
  return {
    toMatch: async (
      messages: Array<string | string[]>,
      retries = 0
    ): Promise<void> => {
      const errorEvents = getState().errors;
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
          return retryOrThrow(
            `Unable to find error: "${message}".\nReceived: ${inspect(
              errorEvents
            )}`
          );
        }
      }
      if (remainingErrorEvents.length > 0) {
        return retryOrThrow(
          `Encountered unexpected errors.\nUnmatched: ${inspect(
            remainingErrorEvents
          )}\n\nFull list: ${inspect(errorEvents)}`
        );
      }

      async function retryOrThrow(message: string) {
        if (retries > MAX_RETRIES) {
          throw new Error(message);
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_AFTER_MILLIS)
          );
          return expectErrors(getState).toMatch(messages, retries + 1);
        }
      }
    },
  };
}

export function expectLoggedMessages(getState: () => PreviewIframeState) {
  return {
    toMatch: async (
      messages: Array<string | string[]>,
      level = "error",
      retries = 0
    ): Promise<void> => {
      const logEvents = getState().logs.filter(
        (log) => !level || log.level === level
      );
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
          return retryOrThrow(
            `Unable to find logged message: "${message}".\nReceived: ${inspect(
              logEvents
            )}`
          );
        }
      }
      if (remainingLogEvents.length > 0) {
        return retryOrThrow(
          `Encountered unexpected logged messages.\nUnmatched: ${inspect(
            remainingLogEvents
          )}\n\nFull list: ${inspect(logEvents)}`
        );
      }

      async function retryOrThrow(message: string) {
        if (retries > MAX_RETRIES) {
          throw new Error(message);
        } else {
          await new Promise((resolve) =>
            setTimeout(resolve, RETRY_AFTER_MILLIS)
          );
          return expectLoggedMessages(getState).toMatch(
            messages,
            level,
            retries + 1
          );
        }
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

import { faTimesCircle } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { ConsoleLogsState } from "./ConsoleLogsState";

export const ConsoleLogs = observer(
  ({ state }: { state: ConsoleLogsState }) => {
    const scrollToBottomRef = useRef<HTMLButtonElement | null>(null);
    useEffect(() => {
      scrollToBottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    });
    const dateFormat = new Intl.DateTimeFormat("default", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    return (
      <div className="flex flex-col min-h-0">
        <div className="flex flex-col overflow-y-auto">
          {state.logs.map((log, i) => (
            <code
              className={clsx([
                "p-2 text-xs whitespace-pre-wrap",
                log.level === "log" && "bg-blue-50 text-blue-400",
                log.level === "warn" && "bg-orange-50 text-orange-400",
                log.level === "error" && "bg-red-50 text-red-600",
              ])}
              key={i}
            >
              [{dateFormat.format(log.timestamp)}] {log.message}
            </code>
          ))}
        </div>
        {state.logs.length > 0 && (
          <button
            className="p-2 text-gray-400 border-t-2 border-gray-100 hover:text-gray-600"
            ref={scrollToBottomRef}
            onClick={state.onClear.bind(state)}
          >
            <FontAwesomeIcon icon={faTimesCircle} /> Clear all
          </button>
        )}
      </div>
    );
  }
);

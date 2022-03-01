import { faAngleRight } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useState } from "react";
import { ErrorState } from "./ErrorState";
import { Suggestion } from "./Suggestion";

export const Error = observer(({ state }: { state: ErrorState }) => {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!state.error?.details) {
      setExpanded(false);
    }
  }, [state.error, setExpanded]);
  const onToggle = useCallback(() => {
    if (!state.error?.details) {
      return;
    }
    setExpanded(!expanded);
  }, [state.error, expanded, setExpanded]);

  if (!state.error) {
    return null;
  }
  return (
    <div
      className={clsx([
        "flex flex-col min-h-0 bg-red-300 text-red-900 text-xs p-2",
        state.error.details && "cursor-pointer",
      ])}
      onClick={onToggle}
    >
      <code id="error-title" className="whitespace-pre-wrap font-bold">
        {state.error.title}
      </code>
      {expanded ? (
        <code
          id="error-details"
          className="whitespace-pre-wrap overflow-x-hidden overflow-y-auto max-h-48"
        >
          {state.error.details}
        </code>
      ) : (
        state.error.details && (
          <button className="self-start opacity-60">
            <FontAwesomeIcon icon={faAngleRight} /> Click to expand
          </button>
        )
      )}
      <Suggestion errorMessage={state.error.title} />
    </div>
  );
});

import {
  faAngleRight,
  faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React, { useCallback, useEffect, useState } from "react";
import { Link } from "../Link";

export const ExpandableError = (props: {
  title: string;
  details?: React.ReactNode;
  suggestion?: {
    message: string;
    url?: string;
  };
}) => {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!props.details) {
      setExpanded(false);
    }
  }, [props.details, setExpanded]);
  const onToggle = useCallback(() => {
    if (!props.details) {
      return;
    }
    setExpanded(!expanded);
  }, [props.details, expanded, setExpanded]);
  return (
    <div
      className={clsx([
        "flex flex-col min-h-0 bg-red-300 text-red-900 text-xs p-2",
        props.details && "cursor-pointer",
      ])}
      onClick={onToggle}
    >
      <code id="error-title" className="whitespace-pre-wrap font-bold">
        {props.title}
      </code>
      {expanded ? (
        <code
          id="error-details"
          className="whitespace-pre-wrap overflow-x-hidden overflow-y-auto max-h-48"
        >
          {props.details}
        </code>
      ) : (
        props.details && (
          <button className="self-start opacity-60">
            <FontAwesomeIcon icon={faAngleRight} /> Click to expand
          </button>
        )
      )}
      {props.suggestion && (
        <div id="suggestion">
          {props.suggestion.url ? (
            <Link id="suggestion-link" href={props.suggestion.url}>
              <FontAwesomeIcon icon={faExternalLinkAlt} />{" "}
              {props.suggestion.message}
            </Link>
          ) : (
            <div id="suggestion-text">{props.suggestion.message}</div>
          )}
        </div>
      )}
    </div>
  );
};

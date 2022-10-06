import { faCircleQuestion } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React from "react";
import { Link } from "../Link";

const dateFormat = new Intl.DateTimeFormat("default", {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export const Item = (props: {
  level: "log" | "info" | "warn" | "error";
  timestamp: number;
  message: string;
  suggestion?: {
    message: string;
    url: string;
  };
}) => {
  return (
    <code
      className={clsx([
        "console-item",
        `console-item-${props.level}`,
        "block p-2 text-xs whitespace-pre-wrap break-words",
        (props.level === "log" || props.level === "info") &&
          "bg-blue-50 odd:bg-blue-100 text-blue-400",
        props.level === "warn" &&
          "bg-orange-50 odd:bg-orange-100 text-orange-400",
        props.level === "error" && "bg-red-50 odd:bg-red-100 text-red-600",
      ])}
    >
      [{dateFormat.format(props.timestamp)}] {props.message}
      {props.suggestion && (
        <Link
          className="block mt-2 p-2 bg-white break-normal shadow text-blue-800 font-sans"
          href={props.suggestion.url}
        >
          <FontAwesomeIcon icon={faCircleQuestion} className="mr-2" />
          {props.suggestion.message}
        </Link>
      )}
    </code>
  );
};

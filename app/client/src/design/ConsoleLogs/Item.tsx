import clsx from "clsx";
import React from "react";

const dateFormat = new Intl.DateTimeFormat("default", {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export const Item = (props: {
  level: "log" | "info" | "warn" | "error";
  timestamp: number;
  message: string;
}) => {
  return (
    <code
      className={clsx([
        "console-item",
        `console-item-${props.level}`,
        "p-2 text-xs whitespace-pre-wrap",
        (props.level === "log" || props.level === "info") &&
          "bg-blue-50 odd:bg-blue-100 text-blue-400",
        props.level === "warn" &&
          "bg-orange-50 odd:bg-orange-100 text-orange-400",
        props.level === "error" && "bg-red-50 odd:bg-red-100 text-red-600",
      ])}
    >
      [{dateFormat.format(props.timestamp)}] {props.message}
    </code>
  );
};

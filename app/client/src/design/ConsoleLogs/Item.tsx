import clsx from "clsx";
import React from "react";

const dateFormat = new Intl.DateTimeFormat("default", {
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
});

export const Item = (props: {
  level: "log" | "warn" | "error";
  timestamp: number;
  message: string;
}) => {
  return (
    <code
      className={clsx([
        "p-2 text-xs whitespace-pre-wrap",
        props.level === "log" && "bg-blue-50 text-blue-400",
        props.level === "warn" && "bg-orange-50 text-orange-400",
        props.level === "error" && "bg-red-50 text-red-600",
      ])}
    >
      [{dateFormat.format(props.timestamp)}] {props.message}
    </code>
  );
};

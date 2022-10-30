import clsx from "clsx";
import React, { useCallback } from "react";
import { Link } from "../Link";

export const LinkBanner = (props: {
  type: "warn" | "info";
  href: string;
  message: string;
  buttonLabel: string;
  onDismiss?(): void;
}) => {
  const { onDismiss } = props;
  const dismiss = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      if (onDismiss) {
        onDismiss();
      }
    },
    [onDismiss]
  );
  return (
    <Link
      className={clsx([
        "flex flex-row items-center px-2 py-1",
        props.type === "warn" && "bg-red-300",
        props.type === "info" && "bg-blue-300",
      ])}
      href={props.href}
    >
      <div className="m-2">{props.message}</div>
      <div className="flex-grow"></div>
      <button
        className={clsx([
          "px-2 py-1 rounded-md font-bold",
          props.type === "warn" && "bg-red-50",
          props.type === "info" && "bg-red-50",
        ])}
      >
        {props.buttonLabel}
      </button>
      {onDismiss && (
        <button className="ml-1 px-2 py-1" onClick={dismiss}>
          Dismiss
        </button>
      )}
    </Link>
  );
};

import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import clsx from "clsx";
import React from "react";

export const VariantButton: React.FC<{
  warning?: boolean;
  icon?: IconDefinition;
  onClick(): void;
}> = (props) => (
  <button
    className={clsx([
      "flex flex-row items-center text-blue-900 hover:bg-blue-200 ml-2 px-2 py-0.5 mr-2 text-sm font-semibold rounded whitespace-nowrap",
      props.warning &&
        "bg-orange-300 hover:bg-orange-200 text-orange-900 hover:text-orange-800",
    ])}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

import { IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React from "react";

export const VariantButton: React.FC<{
  warning?: boolean;
  icon?: IconDefinition;
  onClick(): void;
}> = (props) => (
  <button
    className={clsx([
      "bg-blue-500 hover:bg-blue-400 text-blue-900 px-1.5 py-0.5 ml-2 text-sm font-semibold rounded whitespace-nowrap",
      props.warning &&
        "bg-orange-300 hover:bg-orange-200 text-orange-900 hover:text-orange-800",
    ])}
    onClick={props.onClick}
  >
    {props.icon && <FontAwesomeIcon icon={props.icon} className="mr-2" />}
    {props.children}
  </button>
);

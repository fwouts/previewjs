import { faCode, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React from "react";

export const ComponentButton = (props: {
  label: string;
  icon?: IconDefinition;
  masked?: boolean;
  onClick(): void;
}) => (
  <button
    className={clsx([
      "component inline-flex items-center shrink-0 text-gray-200 mx-5",
      props.masked && "text-gray-500",
    ])}
    onClick={props.onClick}
  >
    <FontAwesomeIcon icon={props.icon || faCode} fixedWidth className="mr-2" />
    {props.label}
  </button>
);

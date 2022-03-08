import { faSpinner, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React from "react";

export const Pill = (props: {
  label: string;
  icon: IconDefinition;
  loading: boolean;
  onClick(): void;
  buttons?: Array<{ key: string; label: string }>;
  selectedButtonKey?: string | null;
  onButtonClicked?(key: string): void;
}) => {
  return (
    <div
      className="inline-flex shrink-0 items-center cursor-pointer rounded-full overflow-hidden px-2 border-2 border-gray-500 bg-gray-800 text-gray-200"
      onClick={props.onClick}
    >
      <span id="component-label" className="m-2 font-bold">
        {props.loading ? (
          <FontAwesomeIcon
            className="mr-2 animate-spin"
            icon={faSpinner}
            fixedWidth
          />
        ) : (
          <FontAwesomeIcon className="mr-2" icon={props.icon} fixedWidth />
        )}
        {props.label}
      </span>
      {props.buttons && props.buttons.length > 0 && (
        <div id="button-list" className="bg-gray-800 inline-flex items-center">
          {props.buttons.map((v) => {
            const selected = props.selectedButtonKey === v.key;
            return (
              <div
                key={v.key}
                className={clsx([
                  "button mx-2 py-2 font-extralight",
                  selected
                    ? "text-blue-50 underline underline-offset-4"
                    : "text-gray-400 hover:text-blue-100",
                ])}
                id={selected ? "selected-button" : undefined}
                onClick={(e) => {
                  if (props.onButtonClicked) {
                    props.onButtonClicked(v.key);
                  }
                  e.stopPropagation();
                }}
              >
                {v.label}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

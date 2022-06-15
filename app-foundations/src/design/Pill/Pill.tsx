import { faSpinner, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import clsx from "clsx";
import React, { ForwardedRef, forwardRef } from "react";

export const Pill = forwardRef(
  (
    props: {
      label: string;
      icon: IconDefinition;
      loading: boolean;
      onClick(): void;
      buttons?: Array<{ key: string; label: string }>;
      selectedButtonKey?: string | null;
      onButtonClicked?(key: string): void;
    },
    ref: ForwardedRef<HTMLDivElement>
  ) => {
    return (
      <div
        ref={ref}
        className="flex flex-row shrink-0 items-stretch cursor-pointer rounded-full overflow-hidden bg-white border-2 border-gray-300 text-gray-800"
        onClick={props.onClick}
      >
        <span id="component-label" className="m-1 px-2">
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
        {props.buttons?.map((v) => {
          const selected = props.selectedButtonKey === v.key;
          return (
            <div
              key={v.key}
              className={clsx([
                "button",
                "flex flex-row items-center px-3 font-light",
                selected
                  ? "text-gray-100 bg-gray-600"
                  : "text-gray-800 hover:bg-gray-200",
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
    );
  }
);

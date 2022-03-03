import {
  faCode,
  faSpinner,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Variant } from "@previewjs/core/controller";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { PreviewState } from "..";

export const SelectedComponent = observer(
  ({
    state,
    icon,
    label,
  }: {
    state: PreviewState;
    icon?: IconDefinition;
    label: string;
  }) => {
    if (!state.component) {
      return null;
    }
    return (
      <UnconnectedSelectedComponent
        icon={icon}
        label={label}
        variants={state.component.details?.variants || null}
        currentVariantKey={state.component.variantKey}
        onClick={() => state.setVariant("custom")}
        onVariantSelected={state.setVariant.bind(state)}
      />
    );
  }
);

const UnconnectedSelectedComponent = ({
  variants: allVariants,
  icon = faCode,
  label,
  currentVariantKey,
  onClick,
  onVariantSelected,
}: {
  label: string;
  icon?: IconDefinition;
  variants: Variant[] | null;
  currentVariantKey: string | null;
  onClick(): void;
  onVariantSelected(variantKey: string): void;
}) => {
  const variants = allVariants?.filter((v) => !v.isEditorDriven);
  return (
    <div
      className="inline-flex shrink-0 items-center cursor-pointer rounded-full overflow-hidden px-2 border-2 border-gray-500 bg-gray-800 text-gray-200"
      onClick={onClick}
    >
      <span id="component-label" className="m-2 font-bold">
        {!variants ? (
          <FontAwesomeIcon
            className="mr-2 animate-spin"
            icon={faSpinner}
            fixedWidth
          />
        ) : (
          <FontAwesomeIcon className="mr-2" icon={icon} fixedWidth />
        )}
        {label}
      </span>
      {variants && variants.length > 0 && (
        <div id="variant-list" className="bg-gray-800 inline-flex items-center">
          {variants.map((v) => {
            const selected = currentVariantKey === v.key;
            return (
              <div
                key={v.key}
                className={clsx([
                  "variant mx-2 py-2 font-extralight",
                  selected
                    ? "text-blue-50 underline underline-offset-4"
                    : "text-gray-400 hover:text-blue-100",
                ])}
                id={selected ? "selected-variant" : undefined}
                onClick={(e) => {
                  onVariantSelected(v.key);
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

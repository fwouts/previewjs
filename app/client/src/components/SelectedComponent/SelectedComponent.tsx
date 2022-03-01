import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Variant } from "@previewjs/core/controller";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { PreviewState } from "..";

export const SelectedComponent = observer(
  ({ state, label }: { state: PreviewState; label: React.ReactNode }) => {
    if (!state.component) {
      return null;
    }
    return (
      <UnconnectedSelectedComponent
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
  label,
  currentVariantKey,
  onClick,
  onVariantSelected,
}: {
  label: React.ReactNode;
  variants: Variant[] | null;
  currentVariantKey: string | null;
  onClick(): void;
  onVariantSelected(variantKey: string): void;
}) => {
  const variants = allVariants?.filter((v) => !v.isEditorDriven);
  return (
    <div
      className="inline-flex items-center cursor-pointer rounded-full overflow-hidden px-2 border-2 border-gray-500 bg-gray-800 text-gray-200"
      onClick={onClick}
    >
      <span id="component-label" className="m-2 font-bold">
        {label}
      </span>
      {!variants ? (
        <FontAwesomeIcon className="mr-2 animate-spin" icon={faSpinner} />
      ) : (
        variants.length > 0 && (
          <div
            id="variant-list"
            className="bg-gray-800 inline-flex items-center"
          >
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
        )
      )}
    </div>
  );
};

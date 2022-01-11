import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Variant } from "@previewjs/core/controller";
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
    <Container onClick={onClick}>
      <ComponentLabel id="component-label">{label}</ComponentLabel>
      {!variants ? (
        <ComponentSpinnerIcon icon={faSpinner} spin />
      ) : (
        variants.length > 0 && (
          <VariantList id="variant-list">
            {variants.map((v) => {
              const selected = currentVariantKey === v.key;
              return (
                <VariantItem
                  key={v.key}
                  $selected={selected}
                  className="variant"
                  id={selected ? "selected-variant" : undefined}
                  onClick={(e) => {
                    onVariantSelected(v.key);
                    e.stopPropagation();
                  }}
                >
                  {v.label}
                </VariantItem>
              );
            })}
          </VariantList>
        )
      )}
    </Container>
  );
};

const Container = styled.div`
  display: inline-flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 16px;
  margin-right: 8px;
  color: hsl(213, 20%, 70%);
  font-size: 1rem;
  background: hsl(213, 60%, 95%);
  color: hsl(213, 60%, 30%);
  user-select: none;
`;

const ComponentSpinnerIcon = styled(FontAwesomeIcon)`
  color: hsl(213, 60%, 20%);
  margin-left: 8px;
`;

const ComponentLabel = styled.div`
  display: inline-flex;
  align-items: center;
  padding: 2px 0;
`;

const VariantList = styled.div`
  display: inline-flex;
  margin-left: 8px;
  margin-right: -4px;
  border-radius: 16px;
  background: hsl(213, 40%, 80%);
`;

const VariantItem = styled.div<{ $selected?: boolean }>`
  cursor: pointer;
  padding: 3px 8px 1px 8px;
  font-size: 0.9rem;
  font-weight: 600;
  color: hsl(213, 40%, 50%);
  ${({ $selected }) =>
    $selected &&
    css`
      color: hsl(213, 80%, 10%);
    `}
  &:hover {
    ${({ $selected }) =>
      !$selected &&
      css`
        color: hsl(213, 60%, 30%);
      `}
`;

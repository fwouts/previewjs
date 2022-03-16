import { faCode, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import React, {ForwardedRef, forwardRef} from "react";
import { Pill } from "../../design/Pill";
import { PreviewState } from "../../PreviewState";

export const Selection = observer(
  forwardRef(
    (
      {
        state,
        icon = faCode,
      }: {
        state: PreviewState;
        icon?: IconDefinition;
      },
      ref: ForwardedRef<HTMLDivElement>
    ) => {
      if (!state.component) {
        return null;
      }
      return (
        <Pill
          ref={ref}
          key="component"
          icon={icon}
          label={state.component.name}
          loading={!state.component.details?.variants}
          buttons={
            state.component.details?.variants?.filter(
              (v) => !v.isEditorDriven
            ) || undefined
          }
          selectedButtonKey={state.component.variantKey}
          onClick={() => state.setVariant("custom")}
          onButtonClicked={state.setVariant.bind(state)}
        />
      );
    }
  )
);

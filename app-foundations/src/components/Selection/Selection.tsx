import { faCode, IconDefinition } from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import React, { ForwardedRef, forwardRef } from "react";
import { Pill } from "../../design/Pill";
import type { PreviewState } from "../../state/PreviewState";

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
          loading={
            !state.component.details ||
            state.component.details.renderingAlwaysFailing === null
          }
          buttons={state.component.details?.variants || undefined}
          selectedButtonKey={state.component.variantKey}
          onClick={() => state.setVariant(null)}
          onButtonClicked={state.setVariant.bind(state)}
        />
      );
    }
  )
);

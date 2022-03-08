import { observer } from "mobx-react-lite";
import React from "react";
import { ExpandableError } from "../../design/ExpandableError";
import { ErrorState } from "./ErrorState";

export const Error = observer(({ state }: { state: ErrorState }) => {
  if (!state.error) {
    return null;
  }
  return (
    <ExpandableError
      title={state.error.title}
      details={state.error.details}
      suggestion={state.suggestion}
    />
  );
});

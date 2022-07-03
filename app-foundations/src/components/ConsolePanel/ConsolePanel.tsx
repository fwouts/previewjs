import { observer } from "mobx-react-lite";
import React from "react";
import { ConsoleLogs } from "../../design/ConsoleLogs";
import type { ConsolePanelState } from "./ConsolePanelState";

export const ConsolePanel = observer(
  ({ state }: { state: ConsolePanelState }) => {
    return (
      <ConsoleLogs.Container onClear={state.onClear.bind(state)}>
        {state.logs.map((log) => (
          <ConsoleLogs.Item key={`${log.timestamp}-${log.message}`} {...log} />
        ))}
      </ConsoleLogs.Container>
    );
  }
);

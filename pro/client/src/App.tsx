import { observer } from "mobx-react-lite";
import React from "react";
import { MainPanel } from "./components/MainPanel";
import { AppState } from "./state/AppState";

export const App = observer(({ state }: { state: AppState }) => {
  return (
    <>
      <MainPanel state={state} />
    </>
  );
});

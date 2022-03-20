import { observer } from "mobx-react-lite";
import React from "react";
import { MainPanel } from "./components/MainPanel";
import { SearchBox } from "./components/SearchBox";
import { LicenseModal } from "./license-modal/LicenseModal";
import { AppState } from "./state/AppState";

export const App = observer(({ state }: { state: AppState }) => {
  return (
    <>
      <MainPanel state={state} />
      <SearchBox items={[]} onItemSelected={() => {}} />
      <LicenseModal state={state.licenseModal} />
    </>
  );
});

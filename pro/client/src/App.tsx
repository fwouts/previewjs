import { observer } from "mobx-react-lite";
import React from "react";
import { MainPanel } from "./components/MainPanel";
import { FullscreenPopup } from "./design/FullscreenPopup";
import { SearchBox } from "./design/SearchBox";
import { LicenseModal } from "./license-modal/LicenseModal";
import { AppState } from "./state/AppState";

export const App = observer(({ state }: { state: AppState }) => {
  return (
    <>
      <MainPanel state={state} />
      {state.pro.search && (
        <FullscreenPopup onClose={() => state.pro.toggleSearch()}>
          <SearchBox
            loading={state.pro.search.status === "loading"}
            labels={{
              empty: "No components detected",
              noResults: "No results",
              loading:
                "Please wait while Preview.js searches for components in your project...",
              refreshButton: "Rerun detection of components",
            }}
            items={state.pro.search.components}
            onRefresh={() => {
              state.pro.search?.refresh();
            }}
            onItemSelected={(item) => {
              state.preview.setComponent(`${item.filePath}:${item.name}`);
              state.pro.toggleSearch();
            }}
          />
        </FullscreenPopup>
      )}
      <LicenseModal state={state.licenseModal} />
    </>
  );
});

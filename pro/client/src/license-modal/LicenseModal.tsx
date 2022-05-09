import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import assertNever from "assert-never";
import { observer } from "mobx-react-lite";
import React from "react";
import { FullscreenPopup } from "../design/FullscreenPopup";
import { LicenseModalState } from "./LicenseModalState";
import { EnterLicenseKey } from "./screens/EnterLicenseKey";
import { LicenseState } from "./screens/LicenseState";
import { RevokeLicenseToken } from "./screens/RevokeLicenseToken";

export const LicenseModal = observer(
  ({ state }: { state: LicenseModalState }) => {
    if (!state.screen) {
      return null;
    }
    return (
      <FullscreenPopup onClose={() => state.toggle()}>
        <h1 className="font-extrabold uppercase text-gray-800 text-sm mx-6 my-4">
          Preview.js Pro
        </h1>
        <div>
          {(() => {
            const screen = state.screen;
            if (screen.loading) {
              return (
                <div className="grid place-items-center my-12 mx-24">
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="text-gray-400 text-3xl animate-spin"
                  />
                </div>
              );
            }
            switch (screen.kind) {
              case "enter-key":
                return <EnterLicenseKey screen={screen} />;
              case "revoke-token":
                return <RevokeLicenseToken screen={screen} />;
              case "license-state":
                return <LicenseState screen={screen} />;
              default:
                throw assertNever(screen);
            }
          })()}
        </div>
      </FullscreenPopup>
    );
  }
);

import { faWarning } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React from "react";
import { ActionButton } from "../../design/ActionButton";
import { ActionsContainer } from "../../design/ActionsContainer";
import { LicenseStateScreen } from "../LicenseModalState";

export const LicenseState = observer(
  ({ screen }: { screen: LicenseStateScreen }) => (
    <>
      <div className="mx-4 my-6">
        <div className="uppercase text-xs font-bold">License key</div>
        <div className="bg-white text-gray-500 font-normal font-mono text-sm filter drop-shadow rounded w-max p-2 mt-1">
          {screen.licenseInfo.maskedKey}
        </div>
        <div className="mt-4 uppercase text-xs font-bold">Status</div>
        {screen.licenseInfo.checked.valid ? (
          <div className="font-bold text-green-700">Valid</div>
        ) : (
          <div className="font-bold text-red-700">
            {screen.licenseInfo.checked.reason}
          </div>
        )}
        <div className="text-xs text-gray-500">
          Last checked:{" "}
          {new Date(screen.licenseInfo.checked.timestamp).toLocaleString()}
        </div>
      </div>
      <ActionsContainer>
        <ActionButton onClick={() => screen.close()}>Close</ActionButton>
        {!screen.licenseInfo.checked.valid &&
        screen.licenseInfo.checked.wasTrial ? (
          <>
            <ActionButton type="cta" href="https://previewjs.com/checkout">
              Buy a license
            </ActionButton>
            <ActionButton onClick={() => screen.unlink(false)}>
              Enter license
            </ActionButton>
          </>
        ) : (
          <>
            <ActionButton type="cta" onClick={() => screen.refresh()}>
              Refresh
            </ActionButton>
            <ActionButton type="danger" onClick={() => screen.unlink()}>
              <FontAwesomeIcon icon={faWarning} /> Unlink
            </ActionButton>
          </>
        )}
      </ActionsContainer>
    </>
  )
);

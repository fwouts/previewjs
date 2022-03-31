import {
  faCheckCircle,
  faQuestionCircle,
  faSpinner,
  faWarning,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "@previewjs/app/client/src/design/Link";
import assertNever from "assert-never";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { useCallback } from "react";
import { ActionButton } from "../design/ActionButton";
import { ActionsContainer } from "../design/ActionsContainer";
import { FullscreenPopup } from "../design/FullscreenPopup";
import { LicenseModalState } from "./LicenseModalState";

export const LicenseModal = observer(
  ({ state }: { state: LicenseModalState }) => {
    const onClose = useCallback(() => {
      state.toggle();
    }, [state]);
    if (!state.screen) {
      return null;
    }
    return (
      <FullscreenPopup onClose={onClose}>
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
                if (screen.success) {
                  return (
                    <div className="grid place-items-center my-12 mx-24">
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="text-green-700 text-6xl"
                      />
                    </div>
                  );
                }
                return (
                  <form
                    onSubmit={(e) => {
                      screen.submit();
                      e.preventDefault();
                    }}
                  >
                    <div className="px-4 max-w-lg">
                      <input
                        id="license-key-input"
                        className={clsx([
                          "rounded-md my-2 p-2 w-full outline-none border-2 border-blue-100 focus:border-blue-500",
                          screen.licenseKey
                            ? "font-mono font-semibold"
                            : "font-medium",
                        ])}
                        autoFocus
                        autoComplete="off"
                        required
                        placeholder="Enter your license key"
                        value={screen.licenseKey}
                        onChange={(event) =>
                          screen.updateLicenseKey(event.target.value)
                        }
                      />
                      {screen.error && (
                        <div className="bg-red-300 text-red-800 text-sm py-2 rounded px-2.5 my-2">
                          {screen.error}
                        </div>
                      )}
                      <div className="my-4 text-sm flex flex-row items-center">
                        <p className="ml-2.5 mr-2 flex-grow">
                          Don't have a key yet?{" "}
                        </p>
                        <Link
                          href="https://previewjs.com/checkout"
                          className="bg-blue-200 hover:bg-blue-300 rounded p-1.5"
                        >
                          Start a free trial today
                        </Link>
                      </div>
                    </div>
                    <ActionsContainer>
                      <ActionButton onClick={onClose}>Back</ActionButton>
                      <ActionButton
                        type="info"
                        href="https://previewjs.com/pro"
                      >
                        <FontAwesomeIcon icon={faQuestionCircle} /> Learn more
                      </ActionButton>
                      <ActionButton type="cta" submit>
                        Confirm
                      </ActionButton>
                    </ActionsContainer>
                    <p className="p-3 pt-0 text-sm bg-gray-900 text-gray-400 shadow-inner">
                      By confirming, you agree to the{" "}
                      <Link
                        href="https://previewjs.com/eula"
                        className="underline"
                      >
                        EULA
                      </Link>{" "}
                      and the{" "}
                      <Link
                        href="https://previewjs.com/privacy"
                        className="underline"
                      >
                        Privacy Policy
                      </Link>
                      .
                    </p>
                  </form>
                );
              case "revoke-token":
                return (
                  <>
                    <div className="mt-2 p-4 text-sm text-center bg-red-200 text-red-800 rounded">
                      <p>There are too many devices using this license key.</p>
                      <p>Please unlink at least one.</p>
                    </div>
                    <ul className="m-4">
                      {screen.existingTokens.map((t, i) => (
                        <li key={t.lastActiveTimestamp}>
                          <label className="block text-sm mb-2 p-1 rounded cursor-pointer">
                            <input
                              type="checkbox"
                              className="mr-2"
                              onChange={(e) =>
                                screen.toggleTokenForDeletion(
                                  t,
                                  e.target.checked
                                )
                              }
                            />
                            device last used{" "}
                            {new Date(t.lastActiveTimestamp).toLocaleString()}
                          </label>
                        </li>
                      ))}
                    </ul>
                    {screen.error && (
                      <div className="bg-red-300 text-red-800 rounded p-2 my-4">
                        {screen.error}
                      </div>
                    )}
                    <ActionsContainer>
                      <ActionButton onClick={() => state.switchToEnterKey()}>
                        Back
                      </ActionButton>
                      <ActionButton
                        type="danger"
                        onClick={() => screen.confirm()}
                      >
                        Unlink devices
                      </ActionButton>
                    </ActionsContainer>
                  </>
                );
              case "license-state":
                return (
                  <>
                    <div className="mx-4 my-6">
                      <div className="uppercase text-xs font-bold">
                        License key
                      </div>
                      <div className="bg-white text-gray-500 font-normal font-mono text-sm filter drop-shadow rounded w-max p-2 mt-1">
                        {screen.licenseInfo.maskedKey}
                      </div>
                      <div className="mt-4 uppercase text-xs font-bold">
                        Status
                      </div>
                      <div className="text-sm flex flex-row">
                        {screen.licenseInfo.checked.valid ? (
                          <div className="font-bold text-green-700">Valid</div>
                        ) : (
                          <div className="font-bold text-red-700">
                            {screen.licenseInfo.checked.reason}
                          </div>
                        )}
                        <div className="text-xs flex-grow text-right text-gray-500">
                          Last checked:{" "}
                          {new Date(
                            screen.licenseInfo.checked.timestamp
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>
                    <ActionsContainer>
                      <ActionButton onClick={onClose}>Close</ActionButton>
                      <ActionButton type="cta" onClick={() => screen.refresh()}>
                        Refresh
                      </ActionButton>
                      <ActionButton
                        type="danger"
                        onClick={() => screen.unlink()}
                      >
                        <FontAwesomeIcon icon={faWarning} /> Unlink
                      </ActionButton>
                    </ActionsContainer>
                  </>
                );
              default:
                throw assertNever(screen);
            }
          })()}
        </div>
      </FullscreenPopup>
    );
  }
);

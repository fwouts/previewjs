import { faCheckCircle, faFan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import assertNever from "assert-never";
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
        <h1 className="font-extrabold uppercase text-gray-800 text-sm mx-4 my-3">
          Preview.js Pro
        </h1>
        <div className="m-4">
          {(() => {
            const screen = state.screen;
            if (screen.loading) {
              return (
                <div className="grid place-items-center my-12 mx-24">
                  <FontAwesomeIcon
                    icon={faFan}
                    className="text-gray-700 text-6xl animate-spin"
                  />
                </div>
              );
            }
            switch (screen.kind) {
              case "welcome":
                return (
                  <>
                    <div
                      className="license-modal-body"
                      dangerouslySetInnerHTML={{
                        __html: screen.config.bodyHtml,
                      }}
                    />
                    <ActionsContainer>
                      <ActionButton
                        type="cta"
                        href="https://previewjs.com/upgrade"
                      >
                        {screen.config.buttons.cta}
                      </ActionButton>
                      <ActionButton onClick={() => state.switchToEnterKey()}>
                        {screen.config.buttons.enter}
                      </ActionButton>
                    </ActionsContainer>
                  </>
                );
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
                    className="flex flex-col"
                    onSubmit={(e) => {
                      screen.submit();
                      e.preventDefault();
                    }}
                  >
                    <label htmlFor="license-key-input">
                      Enter your license key:
                    </label>
                    <input
                      id="license-key-input"
                      className="rounded-md font-mono p-2 mt-2 mb-4 font-semibold w-96 outline-none border-2 border-blue-100 focus:border-blue-500"
                      autoFocus
                      autoComplete="off"
                      required
                      placeholder="XXXX-XXXX-XXXX-XXXX-XXXX"
                      value={screen.licenseKey}
                      onChange={(event) =>
                        screen.updateLicenseKey(event.target.value)
                      }
                    />
                    {screen.error && (
                      <div className="bg-red-300 text-red-800 rounded p-2 mb-4">
                        {screen.error}
                      </div>
                    )}
                    <ActionsContainer>
                      <ActionButton onClick={() => state.switchToWelcome()}>
                        Go back
                      </ActionButton>
                      <ActionButton type="cta" submit>
                        Confirm
                      </ActionButton>
                    </ActionsContainer>
                  </form>
                );
              case "revoke-token":
                return (
                  <div className="license-modal-body">
                    <p>There are too many devices using this license key.</p>
                    <p>Pick unused devices to revoke access:</p>
                    <ul className="mb-4">
                      {screen.existingTokens.map((t, i) => (
                        <li key={t.lastActiveTimestamp}>
                          <label>
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
                            {new Date(t.lastActiveTimestamp).toDateString()}
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
                      <ActionButton type="cta" onClick={() => screen.confirm()}>
                        Confirm
                      </ActionButton>
                    </ActionsContainer>
                  </div>
                );
              case "license-state":
                return (
                  <div className="license-modal-body">
                    <p>
                      License key:
                      <br />
                      <b>{screen.licenseInfo.maskedKey}</b>
                    </p>
                    <p>
                      Status:
                      <br />
                      <b>
                        {screen.licenseInfo.checked.valid
                          ? "Valid"
                          : screen.licenseInfo.checked.reason}
                      </b>{" "}
                      (last checked{" "}
                      {new Date(
                        screen.licenseInfo.checked.timestamp
                      ).toLocaleString()}
                      )
                    </p>
                    <ActionsContainer>
                      <ActionButton onClick={onClose}>Close</ActionButton>
                      <ActionButton type="cta" onClick={() => screen.refresh()}>
                        Refresh
                      </ActionButton>
                      <ActionButton
                        type="danger"
                        onClick={() => screen.unlink()}
                      >
                        Unlink this device
                      </ActionButton>
                    </ActionsContainer>
                  </div>
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

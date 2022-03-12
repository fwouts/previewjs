import { faCheckCircle, faFan } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "@previewjs/app/client/src/design/Link";
import assertNever from "assert-never";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { useCallback, useMemo } from "react";
import { AppState } from "../state/AppState";
import { LicenseModalState } from "./LicenseModalState";

export const LicenseModal = observer(({ state }: { state: AppState }) => {
  const licenseState = useMemo(() => {
    return new LicenseModalState(state);
  }, [state]);
  const onClose = useCallback(() => {
    state.toggleProModal();
  }, [state]);
  return (
    <div
      className="fixed inset-0 w-screen h-screen grid place-items-center z-50 bg-gray-700 bg-opacity-50 filter backdrop-blur"
      onClick={onClose}
    >
      <div
        className="bg-gray-50 rounded-md filter drop-shadow m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h1 className="font-extrabold uppercase text-gray-800 text-sm mx-4 my-3">
          Preview.js Pro
        </h1>
        <div className="m-4">
          {(() => {
            const screen = licenseState.screen;
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
                      <Link
                        className={clsx([buttonBase, buttonCta])}
                        href="https://previewjs.com/upgrade"
                      >
                        {screen.config.buttons.cta}
                      </Link>
                      <button
                        className={clsx([buttonBase, buttonDefault])}
                        onClick={() => licenseState.switchToEnterKey()}
                      >
                        {screen.config.buttons.enter}
                      </button>
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
                      <button
                        className={clsx([buttonBase, buttonDefault])}
                        onClick={() => licenseState.switchToWelcome()}
                      >
                        Go back
                      </button>
                      <input
                        className={clsx([buttonBase, buttonCta])}
                        type="submit"
                        value="Confirm"
                      />
                    </ActionsContainer>
                  </form>
                );
              case "revoke-token":
                return (
                  <div className="license-modal-body">
                    <p>There are too many devices using this license key.</p>
                    <p>Pick unused devices to revoke access:</p>
                    <ul className="mb-4">
                      {screen.existingTokens.map((t) => (
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
                            {t.name} (last used on{" "}
                            {new Date(t.lastActiveTimestamp).toDateString()})
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
                      <button
                        className={clsx([buttonBase, buttonCta])}
                        onClick={() => screen.confirm()}
                      >
                        Confirm
                      </button>
                    </ActionsContainer>
                  </div>
                );
              case "license-state":
                return (
                  <div className="license-modal-body">
                    <p>
                      License key:
                      <br />
                      <b>{screen.licenseState.maskedKey}</b>
                    </p>
                    <p>
                      Status:
                      <br />
                      <b>
                        {screen.licenseState.checked.valid
                          ? "Valid"
                          : screen.licenseState.checked.reason}
                      </b>{" "}
                      (last checked{" "}
                      {new Date(
                        screen.licenseState.checked.timestamp
                      ).toLocaleString()}
                      )
                    </p>
                    <ActionsContainer>
                      <button
                        className={clsx([buttonBase, buttonDefault])}
                        onClick={onClose}
                      >
                        Close
                      </button>
                      <button
                        className={clsx([buttonBase, buttonCta])}
                        onClick={() => screen.refresh()}
                      >
                        Refresh
                      </button>
                      <button
                        className={clsx([buttonBase, buttonDanger])}
                        onClick={() => screen.unlink()}
                      >
                        Unlink this device
                      </button>
                    </ActionsContainer>
                  </div>
                );
              default:
                throw assertNever(screen);
            }
          })()}
        </div>
      </div>
    </div>
  );
});

const buttonBase = "mx-2 py-2 px-4 rounded border-2 cursor-pointer";
const buttonCta = "border-green-700 text-green-700 hover:text-green-800";
const buttonDanger = "border-orange-500 text-orange-500 hover:text-orange-600";
const buttonDefault = "border-transparent text-gray-700 hover:text-gray-800";

const ActionsContainer: React.FC = ({ children }) => (
  <div className="flex flex-row justify-center">{children}</div>
);

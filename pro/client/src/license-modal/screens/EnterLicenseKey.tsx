import {
  faCheckCircle,
  faQuestionCircle,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "@previewjs/app/client/src/design/Link";
import clsx from "clsx";
import React from "react";
import { ActionButton } from "../../design/ActionButton";
import { ActionsContainer } from "../../design/ActionsContainer";
import { EnterLicenseKeyScreen } from "../LicenseModalState";

export const EnterLicenseKey = ({
  screen,
}: {
  screen: EnterLicenseKeyScreen;
}) => {
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
            screen.licenseKey ? "font-mono font-semibold" : "font-medium",
          ])}
          autoFocus
          autoComplete="off"
          required
          placeholder="Enter your license key"
          value={screen.licenseKey}
          onChange={(event) => screen.updateLicenseKey(event.target.value)}
        />
        {screen.error && (
          <div className="bg-red-300 text-red-800 text-sm py-2 rounded px-2.5 my-2">
            {screen.error}
          </div>
        )}
        <div className="my-4 text-sm flex flex-row items-center">
          <p className="ml-2.5 mr-2 flex-grow">Don't have a key yet? </p>
          <Link
            href="https://previewjs.com/checkout"
            className="bg-blue-200 hover:bg-blue-300 rounded p-1.5"
          >
            Start a free trial today
          </Link>
        </div>
      </div>
      <ActionsContainer>
        <ActionButton onClick={() => screen.back()}>Back</ActionButton>
        <ActionButton type="info" href="https://previewjs.com/pro">
          <FontAwesomeIcon icon={faQuestionCircle} /> Learn more
        </ActionButton>
        <ActionButton type="cta" submit>
          Confirm
        </ActionButton>
      </ActionsContainer>
      <p className="p-3 pt-0 text-sm bg-gray-900 text-gray-400 shadow-inner">
        By confirming, you agree to the{" "}
        <Link href="https://previewjs.com/eula" className="underline">
          EULA
        </Link>{" "}
        and the{" "}
        <Link href="https://previewjs.com/privacy" className="underline">
          Privacy Policy
        </Link>
        .
      </p>
    </form>
  );
};

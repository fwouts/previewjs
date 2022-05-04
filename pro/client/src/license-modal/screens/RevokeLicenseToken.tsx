import React from "react";
import { ActionButton } from "../../design/ActionButton";
import { ActionsContainer } from "../../design/ActionsContainer";
import { RevokeLicenseTokenScreen } from "../LicenseModalState";

export const RevokeLicenseToken = ({
  screen,
}: {
  screen: RevokeLicenseTokenScreen;
}) => (
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
                screen.toggleTokenForDeletion(t, e.target.checked)
              }
            />
            device last used {new Date(t.lastActiveTimestamp).toLocaleString()}
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
      <ActionButton onClick={() => screen.back()}>Back</ActionButton>
      <ActionButton type="danger" onClick={() => screen.confirm()}>
        Unlink devices
      </ActionButton>
    </ActionsContainer>
  </>
);

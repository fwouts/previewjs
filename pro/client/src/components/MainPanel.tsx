import { faStar } from "@fortawesome/free-solid-svg-icons";
import { Preview } from "@previewjs/app/client/src/components/Preview";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import { observer } from "mobx-react-lite";
import React from "react";
import { VariantButton } from "../design/VariantButton";
import { AppState } from "../state/AppState";
import { ComponentPicker } from "./ComponentPicker";

export const MainPanel = observer(
  ({ state: { preview, license, licenseModal, pro } }: { state: AppState }) => {
    return (
      <Preview
        state={preview}
        headerAddon={{
          right:
            license.proStatus === "enabled" ? (
              <VariantButton
                icon={faStar}
                onClick={() => licenseModal.toggle()}
              >
                Pro Edition
              </VariantButton>
            ) : license.proStatus === "disabled" ? (
              <VariantButton
                warning={!!license.proInvalidLicenseReason}
                onClick={() => licenseModal.toggle()}
              >
                {license.proInvalidLicenseReason
                  ? license.proInvalidLicenseReason
                  : "Switch to Pro"}
              </VariantButton>
            ) : null,
        }}
        subheader={
          license.proStatus === "enabled" ? (
            <ComponentPicker preview={preview} pro={pro} />
          ) : license.proStatus === "disabled" ? (
            preview.component && <Selection state={preview} />
          ) : null
        }
      />
    );
  }
);

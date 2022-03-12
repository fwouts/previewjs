import { faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Preview } from "@previewjs/app/client/src/components/Preview";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { AppState } from "../state/AppState";

export const MainPanel = observer(
  ({ state: { preview, license, licenseModal } }: { state: AppState }) => {
    return (
      <Preview
        state={preview}
        headerAddon={
          license.proEnabled ? (
            <AppVariant onClick={() => licenseModal.toggle()}>
              <FontAwesomeIcon icon={faStar} className="mr-2" />
              Pro Edition
            </AppVariant>
          ) : (
            <AppVariant
              warning={!!license.proInvalidLicenseReason}
              onClick={() => licenseModal.toggle()}
            >
              {license.proInvalidLicenseReason
                ? license.proInvalidLicenseReason
                : "Switch to Pro"}
            </AppVariant>
          )
        }
        subheader={preview.component && <Selection state={preview} />}
      />
    );
  }
);

const AppVariant: React.FC<{
  warning?: boolean;
  onClick(): void;
}> = (props) => (
  <button
    className={clsx([
      "bg-blue-500 hover:bg-blue-400 text-blue-900 px-1.5 py-0.5 ml-2 text-sm font-semibold rounded whitespace-nowrap",
      props.warning && "",
    ])}
    onClick={props.onClick}
  >
    {props.children}
  </button>
);

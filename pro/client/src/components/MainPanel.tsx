import { faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { filePathFromComponentId } from "@previewjs/app/client/src/component-id";
import {
  Preview,
  SelectedComponent,
  SelectedFile,
} from "@previewjs/app/client/src/components";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { AppState } from "../state/AppState";

export const MainPanel = observer(
  ({
    state: { preview, proEnabled, proInvalidLicenseReason, toggleProModal },
  }: {
    state: AppState;
  }) => {
    const selectedFile = (
      <SelectedFile
        filePath={
          preview.component?.componentId
            ? filePathFromComponentId(preview.component.componentId)
            : ""
        }
      />
    );
    const selectedComponent = preview.component ? (
      <SelectedComponent state={preview} label={preview.component.name} />
    ) : null;
    return (
      <Preview
        state={preview}
        headerAddon={
          proEnabled ? (
            <AppVariant onClick={() => toggleProModal()}>
              <FontAwesomeIcon icon={faStar} className="mr-2" />
              Pro Edition
            </AppVariant>
          ) : (
            <AppVariant
              warning={!!proInvalidLicenseReason}
              onClick={() => toggleProModal()}
            >
              {proInvalidLicenseReason
                ? proInvalidLicenseReason
                : "Switch to Pro"}
            </AppVariant>
          )
        }
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

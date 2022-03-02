import { faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Preview,
  SelectedComponent,
  SelectedFile,
  UpdateBanner,
  VersionInfo,
} from "@previewjs/app/client/src/components";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { AppState } from "../state/AppState";
import { ComponentPicker } from "./ComponentPicker";

export const MainPanel = observer(({ state }: { state: AppState }) => {
  return (
    <Preview
      state={state.preview}
      header={
        state.proEnabled
          ? [
              <>
                <SelectedFile
                  filePath={state.pro.currentFile?.filePath || ""}
                />
                <AppVariant onClick={() => state.toggleProModal()}>
                  <FontAwesomeIcon icon={faStar} className="mr-2" />
                  Pro Edition
                </AppVariant>
                <VersionInfo state={state.preview} />
              </>,
              <ComponentPicker pro={state.pro} preview={state.preview} />,
            ]
          : [
              <>
                <SelectedFile
                  filePath={state.preview.component?.details?.filePath || ""}
                />
                <AppVariant
                  warning={!!state.proInvalidLicenseReason}
                  onClick={() => state.toggleProModal()}
                >
                  {state.proInvalidLicenseReason
                    ? state.proInvalidLicenseReason
                    : "Switch to Pro"}
                </AppVariant>
                <VersionInfo state={state.preview} />
              </>,
              ...(state.preview.component
                ? [
                    <SelectedComponent
                      state={state.preview}
                      label={state.preview.component.name}
                    />,
                  ]
                : []),
            ]
      }
      subheader={
        state.preview.persistedState && (
          <UpdateBanner
            update={state.preview.checkVersionResponse?.update}
            dismissedAt={
              state.preview.persistedState?.updateDismissed?.timestamp
            }
            onDismiss={() => state.preview.onUpdateDismissed()}
          />
        )
      }
    />
  );
});

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

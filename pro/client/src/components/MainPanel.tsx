import { css } from "@emotion/react";
import styled from "@emotion/styled";
import {
  faChevronLeft,
  faChevronRight,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  Preview,
  SelectedComponent,
  SelectedFile,
  UpdateBanner,
  VersionInfo,
} from "@previewjs/app/client/src/components";
import { useWindowWidth } from "@react-hook/window-size";
import { observer } from "mobx-react-lite";
import React from "react";
import { AppState } from "../state/AppState";
import { ComponentPicker } from "./ComponentPicker";
import { SIDE_PANEL_EXPANDED_WIDTH_PX } from "./SidePanel";

export const MainPanel = observer(({ state }: { state: AppState }) => {
  const width = useWindowWidth();
  return (
    <MainContainer>
      <Preview
        state={state.preview}
        header={
          state.proEnabled
            ? [
                <>
                  <ToggleButton
                    className="sidepanel-toggle"
                    onClick={() => state.sidePanel.toggle()}
                  >
                    <FontAwesomeIcon
                      icon={
                        state.sidePanel.toggled ? faChevronLeft : faChevronRight
                      }
                    />
                  </ToggleButton>
                  <SelectedFile
                    filePath={state.pro.currentFile?.filePath || ""}
                  />
                  <AppVariant onClick={() => state.toggleProModal()}>
                    <ProIcon icon={faStar} />
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
                    $warning={!!state.proInvalidLicenseReason}
                    onClick={() => state.toggleProModal()}
                  >
                    {state.proInvalidLicenseReason
                      ? state.proInvalidLicenseReason
                      : "Upgrade to Pro"}
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
        width={
          width - (state.sidePanel.toggled ? SIDE_PANEL_EXPANDED_WIDTH_PX : 0)
        }
      />
    </MainContainer>
  );
});

// See https://stackoverflow.com/a/66689926
const MainContainer = styled.div`
  min-width: 0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`;

const ToggleButton = styled.button`
  padding: 8px;
  margin-left: -8px;
  margin-right: 8px;
  color: hsl(213, 20%, 80%);
  border: none;
  border-radius: 0 8px 8px 0;
  background: hsl(213, 60%, 30%);
  outline: none;
  cursor: pointer;
`;

const ProIcon = styled(FontAwesomeIcon)`
  margin-right: 8px;
`;

const AppVariant = styled.button<{ $warning?: boolean }>`
  border: none;
  background: none;
  font-size: 0.9rem;
  font-weight: 600;
  background: hsl(213, 50%, 80%);
  color: hsl(213, 80%, 40%);
  padding: 2px 6px;
  border-radius: 8px;
  align-self: stretch;
  white-space: nowrap;

  ${({ $warning }) =>
    $warning &&
    css`
      background: hsl(0, 50%, 80%);
      color: hsl(0, 80%, 40%);
    `}

  ${({ onClick }) =>
    onClick &&
    css`
      cursor: pointer;

      &:hover {
        background: hsl(213, 50%, 90%);
      }
    `}
`;

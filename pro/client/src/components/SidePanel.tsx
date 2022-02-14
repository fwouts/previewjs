import { css } from "@emotion/react";
import styled from "@emotion/styled";
import {
  faAngleDown,
  faAngleRight,
  faBug,
  faSpinner,
  faSync,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Link } from "@previewjs/app/client/src/components";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React from "react";
import { Directory, File, SidePanelState } from "../state/SidePanelState";

export const SIDE_PANEL_EXPANDED_WIDTH_PX = 300;

export const SidePanel = observer(({ state }: { state: SidePanelState }) => {
  return state.toggled ? (
    <PanelExpanded>
      {state.error && (
        <ErrorBox>
          <p>
            <b>Uh-oh! Preview.js was unable to detect components</b>
          </p>
          <ErrorIcon icon={faBug} size="5x" />
          <ErrorReportLink href="https://previewjs.com/docs/config/exclude">
            Read: how to exclude directories
          </ErrorReportLink>
          <ErrorMessage>{state.error}</ErrorMessage>
          <RetryButton onClick={() => state.refresh(true)}>
            <FontAwesomeIcon icon={faSync} /> Retry
          </RetryButton>
        </ErrorBox>
      )}
      {state.loading && (
        <>
          <InfoBox>
            <p>Detecting components...</p>
            <p>This can take a minute or two.</p>
          </InfoBox>
          <SpinnerIcon icon={faSpinner} size="3x" spin />
        </>
      )}
      {state.directory && (
        <>
          <RefreshButton
            icon={faSync}
            onClick={() => state.refresh(true)}
            title="Force refresh"
          />
          <DirectoryEntriesList state={state} dir={state.directory} />
        </>
      )}
    </PanelExpanded>
  ) : null;
});

const InfoBox = styled.div`
  text-align: center;
  color: hsl(213, 30%, 90%);
  margin-left: -24px;
`;

const ErrorBox = styled.div`
  text-align: center;
  color: hsl(0, 30%, 90%);
  padding: 8px;
  margin-left: -24px;
`;

const ErrorIcon = styled(FontAwesomeIcon)`
  display: block;
  margin: auto;
`;

const ErrorReportLink = styled(Link)`
  display: block;
  margin: 16px auto;
  color: hsl(0, 30%, 90%);
`;

const ErrorMessage = styled.pre`
  text-align: left;
  background: hsl(0, 40%, 90%);
  color: hsl(0, 80%, 10%);
  border-radius: 8px;
  padding: 8px;
  overflow: auto;
`;

const RetryButton = styled.button`
  display: block;
  margin: 16px auto;
  border: none;
  outline: none;
  font-size: 1rem;
  font-weight: 600;
  padding: 8px;
  background: hsl(213, 50%, 60%);
  color: hsl(213, 60%, 20%);
  border-radius: 8px;
  cursor: pointer;

  &:hover {
    background: hsl(213, 40%, 80%);
    color: hsl(213, 70%, 10%);
  }
`;

const SpinnerIcon = styled(FontAwesomeIcon)`
  color: hsl(213, 30%, 80%);
  margin: 32px auto;
  display: block;
`;

const RefreshButton = styled(FontAwesomeIcon)`
  float: right;
  margin: 4px;
  padding: 8px;
  background: hsl(213, 50%, 60%);
  color: hsl(213, 60%, 20%);
  border-radius: 50%;
  cursor: pointer;

  &:hover {
    background: hsl(213, 40%, 80%);
    color: hsl(213, 70%, 10%);
  }
`;

const DirectoryItem = observer(
  ({
    state,
    name,
    dir,
  }: {
    state: SidePanelState;
    name: string;
    dir: Directory;
  }) => {
    return (
      <DirectoryItemContainer>
        <ItemContainer onClick={() => state.toggleDirectory(dir)}>
          <DirToggle icon={dir.expanded ? faAngleDown : faAngleRight} />
          <LabelContainer
            className={clsx(["directory", dir.expanded && "expanded"])}
            title={name}
            $selected={state.currentRelativeFilePath?.startsWith(dir.dirPath)}
          >
            {name}
          </LabelContainer>
          {!dir.expanded && (
            <ComponentCount
              title={`This directory contains ${
                dir.totalCount
              } exported component${dir.totalCount === 1 ? "" : "s"}`}
            >
              {dir.totalCount}
            </ComponentCount>
          )}
        </ItemContainer>
        {dir.expanded && <DirectoryEntriesList state={state} dir={dir} />}
      </DirectoryItemContainer>
    );
  }
);

const DirectoryEntriesList = ({
  state,
  dir,
}: {
  state: SidePanelState;
  dir: Directory;
}) => {
  return (
    <DirectoryListContainer>
      {Object.entries(dir.entries).map(([name, entry]) => {
        return entry.kind === "dir" ? (
          <DirectoryItem key={name} state={state} name={name} dir={entry} />
        ) : (
          <FileItem key={name} state={state} name={name} file={entry} />
        );
      })}
    </DirectoryListContainer>
  );
};

const FileItem = observer(
  ({
    state,
    name,
    file,
  }: {
    state: SidePanelState;
    name: string;
    file: File;
  }) => {
    const selected = file.relativeFilePath === state.currentRelativeFilePath;
    return (
      <ItemContainer onClick={() => state.onSelect(file)}>
        <LabelContainer
          className="file"
          id={selected ? "selected-file" : undefined}
          title={name}
          $selected={selected}
        >
          {name}
        </LabelContainer>
      </ItemContainer>
    );
  }
);

const DirectoryListContainer = styled.ul`
  margin: 0;
  list-style-type: none;
  padding: 0;
  user-select: none;
  color: hsl(213, 60%, 75%);

  ul {
    margin: 4px 0 4px 16px;
  }
`;

const DirectoryItemContainer = styled.li``;

const ItemContainer = styled.div`
  display: flex;
  align-items: center;
  cursor: pointer;
  margin: 6px 0;
`;

const LabelContainer = styled.div<{ $selected?: boolean }>`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  ${({ $selected }) =>
    $selected &&
    css`
      color: hsl(213, 40%, 95%);
    `}
`;

const DirToggle = styled(FontAwesomeIcon)`
  position: relative;
  display: inline-block;
  left: -1.2rem;
  width: 1rem !important;
  margin-right: -1rem;
`;

const ComponentCount = styled.span`
  margin-left: 8px;
  padding: 2px 6px;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 16px;
  background: hsl(213, 80%, 40%);
  color: hsl(213, 20%, 90%);
`;

const PanelExpanded = styled.div`
  background: hsl(213, 60%, 30%);
  width: ${SIDE_PANEL_EXPANDED_WIDTH_PX}px;
  flex-shrink: 0;
  overflow: auto;
  padding: 8px 8px 8px 32px;
  box-sizing: border-box;

  -ms-overflow-style: none;
  scrollbar-width: none;
  &::-webkit-scrollbar {
    width: 0;
    background: transparent;
  }
`;

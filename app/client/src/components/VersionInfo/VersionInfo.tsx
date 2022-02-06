import styled from "@emotion/styled";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React from "react";
import { Link, PreviewState } from "..";
import { ReactComponent as LogoSvg } from "../../../../../assets/logo.svg";

export const VersionInfo = observer(({ state }: { state: PreviewState }) => {
  return (
    <VersionInfoLink
      target="_blank"
      href="https://github.com/fwouts/previewjs/releases"
    >
      <Logo />
      {state.appInfo ? (
        state.appInfo.version
      ) : (
        <FontAwesomeIcon icon={faSpinner} spin />
      )}
    </VersionInfoLink>
  );
});

const Logo = styled(LogoSvg)`
  width: 1.5rem;
  height: 1.5rem;
  margin-right: 8px;
`;

const VersionInfoLink = styled(Link)`
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  font-size: 0.9rem;
  flex-shrink: 0;
  color: hsl(213, 50%, 70%);
  white-space: nowrap;
  padding: 2px 8px;
  margin-left: 4px;
  border-radius: 8px;
  cursor: pointer;
  align-self: stretch;
`;

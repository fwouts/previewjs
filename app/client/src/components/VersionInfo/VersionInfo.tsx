import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { observer } from "mobx-react-lite";
import React from "react";
import { Link, PreviewState } from "..";
import { ReactComponent as LogoSvg } from "../../../../../assets/logo.svg";

export const VersionInfo = observer(({ state }: { state: PreviewState }) => {
  return (
    <Link
      className="inline-flex items-center whitespace-nowrap text-blue-100 ml-2"
      target="_blank"
      href="https://github.com/fwouts/previewjs/releases"
    >
      <LogoSvg className="h-6 w-6 mr-2" />
      {state.appInfo ? (
        state.appInfo.version
      ) : (
        <FontAwesomeIcon className="animate-spin" icon={faSpinner} />
      )}
    </Link>
  );
});

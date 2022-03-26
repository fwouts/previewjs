import { faSearch, faStar } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Preview } from "@previewjs/app/client/src/components/Preview";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { VariantButton } from "../design/VariantButton";
import { AppState } from "../state/AppState";
import { ComponentPicker } from "./ComponentPicker";

export const MainPanel = observer(
  ({ state: { preview, license, licenseModal, pro } }: { state: AppState }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    useEffect(() => {
      preview.setIframeRef(iframeRef);
    }, [preview]);
    return (
      <Preview
        state={preview}
        appLabel={
          license.proStatus === "enabled" ? "Preview.js Pro" : "Preview.js"
        }
        headerAddon={
          license.proStatus === "enabled" ? (
            <button
              className="text-gray-300 hover:text-white hover:bg-gray-700 rounded-md text-lg px-1 mr-2 cursor-pointer"
              onClick={() => pro.toggleSearch()}
            >
              <FontAwesomeIcon icon={faSearch} fixedWidth />
            </button>
          ) : null
        }
        subheader={
          license.proStatus === "enabled"
            ? pro.currentFile?.filePath && (
                <ComponentPicker preview={preview} pro={pro} />
              )
            : license.proStatus === "disabled"
            ? preview.component && <Selection state={preview} />
            : null
        }
        panelExtra={
          license.proStatus === "enabled" ? (
            <>
              <span className="flex-grow" />
              <VariantButton
                icon={faStar}
                onClick={() => licenseModal.toggle()}
              >
                Pro Edition
              </VariantButton>
            </>
          ) : license.proStatus === "disabled" ? (
            <>
              <span className="flex-grow" />
              <VariantButton
                warning={!!license.proInvalidLicenseReason}
                onClick={() => licenseModal.toggle()}
              >
                {license.proInvalidLicenseReason
                  ? license.proInvalidLicenseReason
                  : "Try Preview.js Pro"}
              </VariantButton>
            </>
          ) : null
        }
        viewport={
          <iframe className="flex-grow" ref={iframeRef} src="/preview/" />
        }
      />
    );
  }
);

import {
  faCircleHalfStroke,
  faDisplay,
  faSearch,
  faStar,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Preview } from "@previewjs/app/client/src/components/Preview";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef, useState } from "react";
import { VariantButton } from "../design/VariantButton";
import { AppState } from "../state/AppState";
import { ComponentPicker } from "./ComponentPicker";
import { Viewport } from "./Viewport";
import { ViewportPanel } from "./ViewportPanel";
import { ViewportZoomButtons } from "./ViewportZoomButtons";

export const MainPanel = observer(
  ({ state: { preview, license, licenseModal, pro } }: { state: AppState }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    useEffect(() => {
      preview.setIframeRef(iframeRef);
    }, [preview]);
    const [background, setBackground] = useState<"light" | "dark">("light");
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
              title={`Search components (${
                navigator.userAgent.includes("Macintosh") ? "Cmd" : "Ctrl"
              }+K)`}
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
        panelTabs={
          license.proStatus === "enabled"
            ? [
                {
                  icon: faDisplay,
                  key: "viewport",
                  label: "Viewport",
                  notificationCount: 0,
                  panel: <ViewportPanel state={pro.viewport} />,
                },
              ]
            : []
        }
        panelExtra={
          license.proStatus === "enabled" ? (
            <>
              <ViewportZoomButtons state={pro.viewport} />
              <button
                className={clsx([
                  "self-stretch px-3 text-gray-600",
                  background === "dark" && "bg-gray-800",
                ])}
                onClick={() =>
                  setBackground(background === "dark" ? "light" : "dark")
                }
              >
                <FontAwesomeIcon
                  icon={faCircleHalfStroke}
                  fixedWidth
                  inverse={background === "dark"}
                />
              </button>
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
          <Viewport
            iframeRef={iframeRef}
            viewport={{
              size: pro.viewport.currentViewport?.size,
              scale: pro.viewport.currentScale,
              background,
            }}
            onViewportContainerSizeUpdated={(size) =>
              pro.viewport.setViewportContainerSize(size)
            }
          />
        }
      />
    );
  }
);

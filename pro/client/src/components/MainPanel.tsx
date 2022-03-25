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
import React, { useState } from "react";
import { VariantButton } from "../design/VariantButton";
import { AppState } from "../state/AppState";
import { ComponentPicker } from "./ComponentPicker";

export const MainPanel = observer(
  ({ state: { preview, license, licenseModal, pro } }: { state: AppState }) => {
    const [width, setWidth] = useState<number | null>(null);
    const [height, setHeight] = useState<number | null>(null);
    const [theme, setTheme] = useState<"light" | "dark">("light");
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
        panelTabs={
          license.proStatus === "enabled"
            ? [
                {
                  icon: faDisplay,
                  key: "viewport",
                  label: "Viewport",
                  notificationCount: 0,
                  panel: (
                    <div>
                      <input
                        type="range"
                        value={width?.toString(10)}
                        max={1920}
                        onChange={(e) =>
                          setWidth(
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                      />
                      <input
                        type="number"
                        value={width?.toString(10)}
                        onChange={(e) =>
                          setWidth(
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                      />
                      <br />
                      <input
                        type="range"
                        value={height?.toString(10)}
                        max={1920}
                        onChange={(e) =>
                          setHeight(
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                      />
                      <input
                        type="number"
                        value={height?.toString(10)}
                        onChange={(e) =>
                          setHeight(
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                      />
                    </div>
                  ),
                },
              ]
            : []
        }
        panelExtra={
          license.proStatus === "enabled" ? (
            <>
              <button
                className={clsx([
                  "self-stretch px-3 text-gray-800",
                  theme === "dark" && "bg-gray-800",
                ])}
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                <FontAwesomeIcon
                  icon={faCircleHalfStroke}
                  fixedWidth
                  inverse={theme === "dark"}
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
        viewport={{
          width: width || "auto",
          height: height || "auto",
          theme,
        }}
      />
    );
  }
);

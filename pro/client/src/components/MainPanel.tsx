import {
  faArrowsLeftRightToLine,
  faCircleHalfStroke,
  faDisplay,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faSearch,
  faStar,
  IconDefinition,
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
    const [background, setTheme] = useState<"light" | "dark">("light");
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
                    <div className="flex-grow bg-gray-600 overflow-auto">
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 p-2">
                        {pro.viewport.options.map((viewport) => (
                          <button
                            key={viewport.id}
                            className={clsx([
                              "flex flex-row items-center p-2 m-2 rounded-md cursor-pointer",
                              viewport.id === pro.viewport.currentViewport.id
                                ? "bg-blue-200 text-blue-900"
                                : "bg-gray-50 text-gray-900",
                            ])}
                            onClick={() => {
                              pro.viewport.setViewportId(viewport.id);
                            }}
                          >
                            <div className="mr-2">
                              <FontAwesomeIcon
                                icon={viewport.icon}
                                rotation={viewport.rotateIcon ? 90 : undefined}
                              />
                            </div>
                            <div className="flex-grow text-left">
                              {viewport.label}
                            </div>
                            {viewport.id === "custom" &&
                            pro.viewport.currentViewport.id === "custom" ? (
                              <div className="flex flex-row">
                                <input
                                  type="number"
                                  className="w-20 text-center rounded-md bg-blue-50"
                                  value={viewport.size?.width}
                                  onChange={(e) =>
                                    pro.viewport.updateCustomViewport({
                                      width: parseInt(e.target.value),
                                    })
                                  }
                                />
                                <div className="mx-1">x</div>
                                <input
                                  type="number"
                                  className="w-20 text-center rounded-md bg-blue-50"
                                  value={viewport.size?.height}
                                  onChange={(e) =>
                                    pro.viewport.updateCustomViewport({
                                      height: parseInt(e.target.value),
                                    })
                                  }
                                />
                              </div>
                            ) : (
                              viewport.size && (
                                <div
                                  className={clsx([
                                    "ml-2 text-sm font-semibold",
                                    viewport.id ===
                                    pro.viewport.currentViewport.id
                                      ? "text-blue-800"
                                      : "text-gray-500",
                                  ])}
                                >
                                  {viewport.size.width}x{viewport.size.height}
                                </div>
                              )
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  ),
                },
              ]
            : []
        }
        panelExtra={
          license.proStatus === "enabled" ? (
            <>
              <div className="flex flex-row rounded-md mx-2 p-0.5 border-2 border-gray-200">
                <ZoomButton
                  title="Zoom in"
                  icon={faMagnifyingGlassPlus}
                  onClick={() => pro.viewport.increaseOrDecreaseScale(+1)}
                />
                <ZoomButton
                  title="Reset zoom to 100%"
                  label={`${Math.round(pro.viewport.currentScale * 100)}%`}
                  onClick={() => pro.viewport.setScale(1)}
                />
                <ZoomButton
                  title="Zoom out"
                  icon={faMagnifyingGlassMinus}
                  onClick={() => pro.viewport.increaseOrDecreaseScale(-1)}
                />
                {pro.viewport.currentViewport.size && (
                  <ZoomButton
                    title="Fit to viewport"
                    icon={faArrowsLeftRightToLine}
                    rotate
                    disabled={
                      pro.viewport.currentScale === pro.viewport.scaleToFit
                    }
                    onClick={() =>
                      pro.viewport.setScale(pro.viewport.scaleToFit)
                    }
                  />
                )}
              </div>
              <button
                className={clsx([
                  "self-stretch px-3 text-gray-600",
                  background === "dark" && "bg-gray-800",
                ])}
                onClick={() =>
                  setTheme(background === "dark" ? "light" : "dark")
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
        viewport={{
          size: pro.viewport.currentViewport?.size,
          scale: pro.viewport.currentScale,
          background,
        }}
        onViewportContainerSizeUpdated={(size) =>
          pro.viewport.setViewportContainerSize(size)
        }
      />
    );
  }
);

// TODO: Move.
const ZoomButton = (
  props: {
    title: string;
    onClick(): void;
    rotate?: boolean;
    disabled?: boolean;
  } & ({ icon: IconDefinition } | { label: string })
) => (
  <button
    className={clsx(
      ["self-stretch px-2"],
      props.rotate && "rotate-45",
      props.disabled
        ? "text-gray-300"
        : "cursor-pointer text-gray-600 hover:text-gray-900"
    )}
    title={props.title}
    onClick={props.onClick}
    disabled={props.disabled}
  >
    {"icon" in props ? (
      <FontAwesomeIcon icon={props.icon} />
    ) : (
      <span className="text-sm grid place-self-center w-8">{props.label}</span>
    )}
  </button>
);

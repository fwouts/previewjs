import {
  faArrowsLeftRightToLine,
  faCircleHalfStroke,
  faDesktop,
  faDisplay,
  faExpand,
  faLaptop,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
  faMobilePhone,
  faPencil,
  faSearch,
  faStar,
  faTablet,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { Preview } from "@previewjs/app/client/src/components/Preview";
import { Selection } from "@previewjs/app/client/src/components/Selection";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, { useCallback, useLayoutEffect, useState } from "react";
import { VariantButton } from "../design/VariantButton";
import { AppState } from "../state/AppState";
import { ComponentPicker } from "./ComponentPicker";

// TODO: Move
interface ViewportOption {
  id: string;
  icon: IconDefinition;
  rotateIcon?: boolean;
  label: string;
  dimensions: {
    width: number;
    height: number;
  } | null;
}

export const MainPanel = observer(
  ({ state: { preview, license, licenseModal, pro } }: { state: AppState }) => {
    const [viewportId, setViewportId] = useState("expand");
    const [customWidth, setCustomWidth] = useState(100);
    const [customHeight, setCustomHeight] = useState(100);
    const viewportOptions: ViewportOption[] = [
      {
        id: "expand",
        icon: faExpand,
        label: "Fill available space",
        dimensions: null,
      },
      {
        id: "mobile-portrait",
        icon: faMobilePhone,
        label: "Mobile (portrait)",
        dimensions: { width: 375, height: 812 },
      },
      {
        id: "mobile-landscape",
        icon: faMobilePhone,
        label: "Mobile (landscape)",
        rotateIcon: true,
        dimensions: { width: 812, height: 375 },
      },
      {
        id: "tablet-portrait",
        icon: faTablet,
        label: "Tablet (portrait)",
        dimensions: { width: 600, height: 1200 },
      },
      {
        id: "tablet-landscape",
        icon: faTablet,
        rotateIcon: true,
        label: "Tablet (landscape)",
        dimensions: { width: 1200, height: 600 },
      },
      {
        id: "laptop",
        icon: faLaptop,
        label: "Laptop",
        dimensions: { width: 1440, height: 900 },
      },
      {
        id: "desktop",
        icon: faDesktop,
        label: "Desktop",
        dimensions: { width: 1920, height: 1080 },
      },
      {
        id: "custom",
        icon: faPencil,
        label: "Custom",
        dimensions: { width: customWidth, height: customHeight },
      },
    ];
    const [viewportScale, setViewportScale] = useState(1);
    const [background, setTheme] = useState<"light" | "dark">("light");
    const currentViewport = viewportOptions.find((v) => v.id === viewportId);
    const [viewportContainerSize, setViewportContainerSize] = useState<{
      width: number;
      height: number;
    }>({
      width: 0,
      height: 0,
    });
    const viewportDimensions = currentViewport?.dimensions;
    const viewportContainerPadding = 24;
    const viewportWidthRatio = viewportDimensions
      ? (viewportContainerSize.width - viewportContainerPadding * 2) /
        viewportDimensions.width
      : 1;
    const viewportHeightRatio = viewportDimensions
      ? (viewportContainerSize.height - viewportContainerPadding * 2) /
        viewportDimensions.height
      : 1;
    const scaleToFit = Math.min(viewportHeightRatio, viewportWidthRatio);
    useLayoutEffect(() => {
      setViewportScale(scaleToFit);
    }, [scaleToFit]);
    const increaseOrDecreaseScale = useCallback(
      (stepsChange: number) => {
        const scalePercent = Math.round(viewportScale * 100);
        const steps = [
          10, 30, 50, 67, 80, 90, 100, 110, 120, 133, 150, 170, 200, 240, 300,
          400, 500,
        ];
        const currentIndex = steps.findIndex((s) => s >= scalePercent);
        const newScalePercent =
          steps[
            Math.max(0, Math.min(steps.length - 1, currentIndex + stepsChange))
          ]!;
        setViewportScale(newScalePercent / 100);
      },
      [viewportScale, setViewportScale]
    );
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
                        {viewportOptions.map((viewport) => (
                          <button
                            key={viewport.id}
                            className={clsx([
                              "flex flex-row items-center p-2 m-2 rounded-md cursor-pointer",
                              viewport.id === viewportId
                                ? "bg-blue-200 text-blue-900"
                                : "bg-gray-50 text-gray-900",
                            ])}
                            onClick={() => {
                              setViewportId(viewport.id);
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
                            viewportId === "custom" ? (
                              <div className="flex flex-row">
                                <input
                                  type="number"
                                  className="w-20 text-center rounded-md bg-blue-50"
                                  value={customWidth}
                                  onChange={(e) =>
                                    setCustomWidth(parseInt(e.target.value))
                                  }
                                />
                                <div className="mx-1">x</div>
                                <input
                                  type="number"
                                  className="w-20 text-center rounded-md bg-blue-50"
                                  value={customHeight}
                                  onChange={(e) =>
                                    setCustomHeight(parseInt(e.target.value))
                                  }
                                />
                              </div>
                            ) : (
                              viewport.dimensions && (
                                <div
                                  className={clsx([
                                    "ml-2 text-sm font-semibold",
                                    viewport.id === viewportId
                                      ? "text-blue-800"
                                      : "text-gray-500",
                                  ])}
                                >
                                  {viewport.dimensions.width}x
                                  {viewport.dimensions.height}
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
                  onClick={() => increaseOrDecreaseScale(+1)}
                />
                <ZoomButton
                  title="Reset zoom to 100%"
                  label={`${Math.round(viewportScale * 100)}%`}
                  onClick={() => setViewportScale(1)}
                />
                <ZoomButton
                  title="Zoom out"
                  icon={faMagnifyingGlassMinus}
                  onClick={() => increaseOrDecreaseScale(-1)}
                />
                {currentViewport?.dimensions && (
                  <ZoomButton
                    title="Fit to viewport"
                    icon={faArrowsLeftRightToLine}
                    rotate
                    disabled={viewportScale === scaleToFit}
                    onClick={() => setViewportScale(scaleToFit)}
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
          dimensions: currentViewport?.dimensions,
          scale: viewportScale,
          background,
        }}
        onViewportContainerSizeUpdated={setViewportContainerSize}
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

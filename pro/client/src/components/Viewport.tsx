import clsx from "clsx";
import React, { useCallback, useLayoutEffect, useMemo, useRef } from "react";

export const Viewport = ({
  iframeRef,
  viewport: {
    size: viewportDimensions,
    scale: viewportScale = 1,
    background: viewportBackground = "light",
  } = {},
  onViewportContainerSizeUpdated,
}: {
  iframeRef: React.RefObject<HTMLIFrameElement>;
  viewport?: {
    size?: ViewportSize | null;
    scale?: number;
    background?: "light" | "dark";
  };
  onViewportContainerSizeUpdated?(size: ViewportSize): void;
}) => {
  const viewportContainerRef = useRef<HTMLDivElement | null>(null);
  const viewportContainerSizeRef = useRef<ViewportSize>();
  const viewportContainerResizeObserver = useMemo(
    () =>
      new ResizeObserver(() => {
        updateViewportContainerSize();
      }),
    []
  );
  const observedRef = useRef<HTMLDivElement | null>(null);
  const updateViewportContainerSize = useCallback(() => {
    const viewportContainer = viewportContainerRef.current;
    if (!viewportContainer || !onViewportContainerSizeUpdated) {
      return;
    }
    if (observedRef.current !== viewportContainer) {
      if (observedRef.current) {
        viewportContainerResizeObserver.unobserve(observedRef.current);
      }
      viewportContainerResizeObserver.observe(viewportContainer);
      observedRef.current = viewportContainer;
    }
    const size = {
      width: viewportContainer.offsetWidth,
      height: viewportContainer.offsetHeight,
    };
    if (
      !viewportContainerSizeRef.current ||
      size.width !== viewportContainerSizeRef.current.width ||
      size.height !== viewportContainerSizeRef.current.height
    ) {
      viewportContainerSizeRef.current = size;
      onViewportContainerSizeUpdated(size);
    }
  }, [viewportContainerResizeObserver, onViewportContainerSizeUpdated]);
  useLayoutEffect(updateViewportContainerSize);
  return (
    <div
      ref={viewportContainerRef}
      className={clsx([
        "flex-grow flex flex-col overflow-auto relative",
        viewportDimensions
          ? "bg-gray-50"
          : viewportBackground === "dark"
          ? "bg-gray-800"
          : "bg-white",
      ])}
    >
      <div
        className={clsx([
          viewportDimensions
            ? "absolute"
            : "flex-grow flex flex-col justify-center flex-nowrap overflow-auto",
        ])}
        style={{
          transformOrigin: "0 0",
          transform: `scaleX(${viewportScale}) scaleY(${viewportScale})`,
          ...(viewportDimensions && viewportContainerSizeRef.current
            ? {
                left: Math.max(
                  0,
                  (viewportContainerSizeRef.current.width -
                    viewportDimensions.width * viewportScale) /
                    2
                ),
                top: Math.max(
                  0,
                  (viewportContainerSizeRef.current.height -
                    viewportDimensions.height * viewportScale) /
                    2
                ),
              }
            : {}),
        }}
      >
        <iframe
          className={clsx([
            viewportDimensions
              ? "self-center flex-shrink-0 border-4 border-white rounded-xl filter drop-shadow-lg"
              : "self-stretch flex-grow",
            viewportBackground === "dark" ? "bg-gray-800" : "bg-white",
          ])}
          ref={iframeRef}
          src="/preview/"
          width={viewportDimensions?.width}
          height={viewportDimensions?.height}
        />
      </div>
    </div>
  );
};

export interface ViewportSize {
  width: number;
  height: number;
}

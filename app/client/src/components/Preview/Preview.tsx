import { faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { faBars, faCode, faExpandAlt } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useWindowSize } from "@react-hook/window-size";
import clsx from "clsx";
import { observer } from "mobx-react-lite";
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { decodeComponentId } from "../../component-id";
import { FilePath } from "../../design/FilePath";
import { Header } from "../../design/Header";
import { Link } from "../../design/Link";
import { PropsEditor } from "../../design/PropsEditor";
import { SmallLogo } from "../../design/SmallLogo";
import { PanelTab, TabbedPanel } from "../../design/TabbedPanel";
import { PreviewState } from "../../PreviewState";
import { ActionLogs } from "../ActionLogs";
import { ConsolePanel } from "../ConsolePanel";
import { Error } from "../Error";
import { UpdateBanner } from "../UpdateBanner";

export const Preview = observer(
  ({
    state,
    appLabel,
    headerAddon,
    subheader,
    panelTabs,
    panelExtra,
    viewport: {
      dimensions: viewportDimensions,
      scale: viewportScale = 1,
      background: viewportBackground = "light",
    } = {},
    onViewportContainerSizeUpdated,
  }: {
    state: PreviewState;
    appLabel: string;
    headerAddon?: React.ReactNode;
    subheader?: React.ReactNode;
    panelTabs?: PanelTab[];
    panelExtra?: React.ReactNode;
    viewport?: {
      dimensions?: {
        width: number;
        height: number;
      } | null;
      scale?: number;
      background?: "light" | "dark";
    };
    onViewportContainerSizeUpdated?(size: {
      width: number;
      height: number;
    }): void;
  }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    useEffect(() => {
      state.setIframeRef(iframeRef);
    }, [state]);
    const [width, height] = useWindowSize();
    const panelHeight = height * 0.3;
    const viewportContainerRef = useRef<HTMLDivElement | null>(null);
    const viewportContainerSizeRef =
      useRef<{ width: number; height: number }>();
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
      console.error(size);
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

    if (!state.reachable) {
      return (
        <div className="h-screen bg-gray-700 text-gray-100 p-2 grid place-items-center text-lg">
          <div
            id="app-error"
            className="p-4 rounded-lg text-red-800 bg-red-50 filter drop-shadow-lg"
          >
            Server disconnected. Is Preview.js still running?
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen overflow-hidden bg-white">
        <ActionLogs state={state.actionLogs} />
        <Header>
          <Header.Row>
            {headerAddon}
            {state.component?.componentId && (
              <FilePath
                key="file"
                filePath={
                  decodeComponentId(state.component.componentId).currentFilePath
                }
              />
            )}
            <Link
              href={document.location.href}
              target="_blank"
              title="Open in new tab"
              className="text-gray-500 hover:text-gray-200 ml-2 text-lg"
            >
              <FontAwesomeIcon icon={faExpandAlt} fixedWidth />
            </Link>
            <div className="flex-grow"></div>
            <SmallLogo
              href="https://previewjs.com/docs"
              label={appLabel}
              title={state.appInfo?.version && `v${state.appInfo.version}`}
            />
            <Link
              className="ml-2 text-xl text-[#1DA1F2] hover:text-white"
              href="https://twitter.com/previewjs"
              target="_blank"
              title="Follow Preview.js on Twitter"
            >
              <FontAwesomeIcon icon={faTwitter} fixedWidth />
            </Link>
            <Link
              className="ml-2 text-xl bg-[#333] text-white rounded-md hover:bg-white hover:text-[#333]"
              href="https://github.com/fwouts/previewjs"
              target="_blank"
              title="Star Preview.js on GitHub"
            >
              <FontAwesomeIcon icon={faGithub} fixedWidth />
            </Link>
          </Header.Row>
          {subheader && (
            <Header.Row className="bg-gray-100">{subheader}</Header.Row>
          )}
        </Header>
        <UpdateBanner state={state.updateBanner} />
        {state.component ? (
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
        ) : (
          <div
            id="no-selection"
            className="flex-grow bg-gray-700 text-gray-100 p-2 grid place-items-center text-lg"
          >
            Please select a component to preview.
          </div>
        )}
        <Error state={state.error} />
        <TabbedPanel
          defaultTabKey="props"
          tabs={[
            ...(state.component?.variantKey === "custom"
              ? [
                  {
                    label: "Properties",
                    key: "props",
                    icon: faCode,
                    notificationCount: 0,
                    panel: state.component?.details && (
                      <PropsEditor
                        documentId={state.component.componentId}
                        height={height}
                        width={width}
                        onUpdate={state.updateProps.bind(state)}
                        onReset={
                          state.component.details.invocation !==
                          state.component.details.defaultInvocation
                            ? state.resetProps.bind(state)
                            : undefined
                        }
                        source={state.component.details.invocation}
                        typeDeclarationsSource={
                          state.component.details.typeDeclarations
                        }
                      />
                    ),
                  },
                ]
              : []),
            {
              label: "Console",
              key: "console",
              icon: faBars,
              notificationCount: state.consoleLogs.unreadCount,
              panel: <ConsolePanel state={state.consoleLogs} />,
            },
            ...(panelTabs || []),
          ]}
          height={panelHeight}
          extra={panelExtra}
        />
      </div>
    );
  }
);

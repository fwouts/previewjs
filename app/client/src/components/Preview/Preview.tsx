import { faGithub, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { faExternalLinkAlt } from "@fortawesome/free-solid-svg-icons";
import { useWindowSize } from "@react-hook/window-size";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { Header } from "../../design/Header";
import { PropsEditor } from "../../design/PropsEditor";
import { TabbedPanel } from "../../design/TabbedPanel";
import { PreviewState } from "../../PreviewState";
import { ActionLogs } from "../ActionLogs";
import { ConsolePanel } from "../ConsolePanel";
import { Error } from "../Error";
import { UpdateBanner } from "../UpdateBanner";

export const Preview = observer(
  ({ state, header }: { state: PreviewState; header?: React.ReactNode[] }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    useEffect(() => {
      state.setIframeRef(iframeRef);
    }, [state]);
    const [width, height] = useWindowSize();
    const panelHeight = height * 0.3;

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
      <div className="flex flex-col h-screen overflow-hidden">
        <ActionLogs state={state.actionLogs} />
        <Header>
          {header?.filter(Boolean).map((h, i) => (
            <Header.Row key={i}>{h}</Header.Row>
          ))}
        </Header>
        <UpdateBanner state={state.updateBanner} />
        {state.component ? (
          <iframe className="flex-grow" ref={iframeRef} src="/preview/" />
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
              notificationCount: state.consoleLogs.unreadCount,
              panel: <ConsolePanel state={state.consoleLogs} />,
            },
          ]}
          height={panelHeight}
          links={[
            {
              href: document.location.href,
              title: "Open in browser",
              icon: faExternalLinkAlt,
              className: "text-base",
            },
            {
              href: "https://github.com/fwouts/previewjs",
              title: "GitHub",
              icon: faGithub,
              color: "#333",
            },
            {
              href: "https://twitter.com/fwouts",
              title: "Follow Preview.js's author on Twitter",
              icon: faTwitter,
              color: "#1DA1F2",
            },
          ]}
        />
      </div>
    );
  }
);

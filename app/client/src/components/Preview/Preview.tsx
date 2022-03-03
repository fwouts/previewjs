import { useWindowSize } from "@react-hook/window-size";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { PreviewState } from "../../PreviewState";
import { ActionLogs } from "../ActionLogs";
import { BottomPanel } from "../BottomPanel";
import { ConsoleLogs } from "../ConsoleLogs";
import { Error } from "../Error";
import { Header } from "../Header";
import { PropsEditor } from "../PropsEditor";

export const Preview = observer(
  ({
    state,
    header,
    subheader,
    width,
  }: {
    state: PreviewState;
    header?: React.ReactNode[];
    subheader?: React.ReactNode;
    width?: number;
  }) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    useEffect(() => {
      state.setIframeRef(iframeRef);
    }, [state]);
    const [defaultWidth, height] = useWindowSize();
    width ||= defaultWidth;
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
          {header?.map((h, i) => (
            <Header.Row key={i}>{h}</Header.Row>
          ))}
        </Header>
        {subheader}
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
        <BottomPanel
          tabs={[
            ...(state.component?.variantKey === "custom"
              ? [
                  {
                    label: "Properties",
                    key: "props",
                    notificationCount: 0,
                    panel: (
                      <PropsEditor
                        state={state}
                        height={panelHeight}
                        width={width}
                      />
                    ),
                  },
                ]
              : []),
            {
              label: "Console",
              key: "console",
              notificationCount: state.consoleLogs.unreadCount,
              panel: <ConsoleLogs state={state.consoleLogs} />,
            },
          ]}
          height={panelHeight}
        />
      </div>
    );
  }
);

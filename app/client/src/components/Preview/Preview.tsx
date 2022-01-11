import styled from "@emotion/styled";
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
    header?: React.ReactNodeArray;
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
        <Fullscreen>
          <AppError id="app-error">
            Server disconnected. Is Preview.js still running?
          </AppError>
        </Fullscreen>
      );
    }

    return (
      <Container>
        <ActionLogs state={state.actionLogs} />
        <Header>
          {header?.map((h, i) => (
            <Header.Row key={i}>{h}</Header.Row>
          ))}
        </Header>
        {subheader}
        {state.component ? (
          <Iframe ref={iframeRef} src="/preview/" />
        ) : (
          <NoSelection id="no-selection">
            Please select a component to preview.
          </NoSelection>
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
      </Container>
    );
  }
);

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
`;

const Fullscreen = styled.div`
  background: hsl(213, 70%, 82%);
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  flex-grow: 1;
  height: 100vh;
`;

const AppError = styled.div`
  box-shadow: 0 2px 4px 0 hsla(213, 20%, 70%, 0.2);
  border-radius: 8px;
  background: #fff;
  padding: 8px;
  color: hsl(0, 60%, 40%);
`;

const Iframe = styled.iframe`
  border: none;
  flex-grow: 1;
`;

const NoSelection = styled.div`
  padding: 8px;
  flex-grow: 1;
  background: hsl(213, 90%, 10%);
  color: hsl(213, 20%, 80%);
`;

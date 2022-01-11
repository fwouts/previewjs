import styled from "@emotion/styled";
import { LogLevel } from "@previewjs/core/controller";
import { observer } from "mobx-react-lite";
import React, { useEffect } from "react";
import { ConsoleLogsState } from "./ConsoleLogsState";

export const ConsoleLogs = observer(
  ({ state }: { state: ConsoleLogsState }) => {
    const scrollToBottomRef = React.createRef<HTMLDivElement>();
    useEffect(() => {
      scrollToBottomRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    });
    const dateFormat = new Intl.DateTimeFormat("default", {
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    return (
      <ConsolePanelContainer>
        {state.logs.map((log, i) => (
          <LogMessageContainer level={log.level} className="code" key={i}>
            [{dateFormat.format(log.timestamp)}] {log.message}
          </LogMessageContainer>
        ))}
        {state.logs.length > 0 && (
          <ClearAllButton
            ref={scrollToBottomRef}
            onClick={state.onClear.bind(state)}
          >
            Clear all
          </ClearAllButton>
        )}
      </ConsolePanelContainer>
    );
  }
);

const ConsolePanelContainer = styled.div`
  flex-grow: 1;
  overflow: auto;
`;

const LogMessageContainer = styled.div<{ level: LogLevel }>`
  white-space: pre-wrap;
  font-size: 10px;
  padding: 8px;
  color: ${({ level }) =>
    ({
      log: "#555",
      warn: "#f60",
      error: "#d00",
    }[level])};

  &:nth-of-type(even) {
    background: rgba(255, 255, 255, 0.8);
  }
`;

const ClearAllButton = styled.div`
  padding: 8px;
  text-align: right;
  cursor: pointer;
  color: hsl(213, 82%, 45%);
`;

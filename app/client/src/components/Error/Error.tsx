import { css } from "@emotion/react";
import styled from "@emotion/styled";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useState } from "react";
import { ErrorState } from "./ErrorState";
import { Suggestion } from "./Suggestion";

export const Error = observer(({ state }: { state: ErrorState }) => {
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    if (!state.error?.details) {
      setExpanded(false);
    }
  }, [state.error, setExpanded]);
  const onToggle = useCallback(() => {
    if (!state.error?.details) {
      return;
    }
    setExpanded(!expanded);
  }, [state.error, expanded, setExpanded]);

  if (!state.error) {
    return null;
  }
  return (
    <Container $expandable={!!state.error.details} onClick={onToggle}>
      <ErrorTitle id="error-title">{state.error.title}</ErrorTitle>
      {expanded ? (
        <ErrorDetails id="error-details">{state.error.details}</ErrorDetails>
      ) : (
        state.error.details && <ClickToExpand>Click to expand</ClickToExpand>
      )}
      <Suggestion errorMessage={state.error.title} />
    </Container>
  );
});

const Container = styled.div<{ $expandable: boolean }>`
  display: flex;
  flex-direction: column;
  background: hsl(0, 50%, 80%);
  color: hsl(0, 80%, 20%);
  padding: 8px;
  min-height: 0;
  ${({ $expandable }) =>
    $expandable &&
    css`
      cursor: pointer;
    `}
`;

const ErrorBase = styled.pre`
  display: block;
  margin: 0;
  white-space: pre-wrap;
`;

const ErrorTitle = styled(ErrorBase)`
  font-weight: 600;
`;

const ClickToExpand = styled.div`
  font-size: 0.7rem;
  font-weight: 200;
  margin-top: 8px;

  &::before {
    content: "> ";
  }
`;

const ErrorDetails = styled(ErrorBase)`
  overflow-x: hidden;
  overflow-y: auto;
  max-height: 200px;
`;

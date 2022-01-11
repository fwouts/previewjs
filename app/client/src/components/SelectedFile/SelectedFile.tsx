import styled from "@emotion/styled";
import React from "react";

export const SelectedFile = ({ filePath }: { filePath: string }) => {
  const segments = filePath.split(/[/\\]/);
  return (
    <Location>
      {segments.map((segment, i) => (
        <React.Fragment key={i}>
          {i > 0 && <Separator>/</Separator>}
          <Segment>{segment}</Segment>
        </React.Fragment>
      ))}
    </Location>
  );
};

const Location = styled.div`
  display: flex;
  flex-direction: row;
  flex-grow: 1;
  flex-wrap: wrap;
  color: hsl(213, 40%, 80%);
`;

const Separator = styled.span`
  margin: 0 0.2rem;
`;

const Segment = styled.span`
  white-space: nowrap;
`;

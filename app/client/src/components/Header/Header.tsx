import styled from "@emotion/styled";

const Container = styled.div`
  font-size: 0.9rem;
  background: hsl(213, 60%, 20%);
`;

const Row = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 8px;
`;

export const Header = Container as typeof Container & { Row: typeof Row };
Header.Row = Row;

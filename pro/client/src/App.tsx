import styled from "@emotion/styled";
import { observer } from "mobx-react-lite";
import React from "react";
import { MainPanel } from "./components/MainPanel";
import { LicenseModal } from "./license-modal/LicenseModal";
import { AppState } from "./state/AppState";

export const App = observer(({ state }: { state: AppState }) => {
  return (
    <>
      <Container>
        <MainPanel state={state} />
      </Container>
      {state.proModalToggled && <LicenseModal state={state} />}
    </>
  );
});

const Container = styled.div`
  display: flex;
  flex-direction: row;
  height: 100vh;
`;

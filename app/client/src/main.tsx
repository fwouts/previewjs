import { observer } from "mobx-react-lite";
import React from "react";
import ReactDOM from "react-dom";
import {
  Preview,
  PreviewState,
  SelectedComponent,
  SelectedFile,
  UpdateBanner,
  VersionInfo,
} from "./components";
import "./index.css";

const state = new PreviewState();
state.start().catch(console.error);

const App = observer(() => (
  <Preview
    state={state}
    header={[
      <>
        <SelectedFile
          key="file"
          filePath={state.component?.details?.relativeFilePath || ""}
        />
        <VersionInfo key="info" state={state} />
      </>,
      ...(state.component
        ? [
            <SelectedComponent
              key="component"
              state={state}
              label={state.component.name}
            />,
          ]
        : []),
    ]}
    subheader={
      state.persistedState && (
        <UpdateBanner
          update={state.checkVersionResponse?.update}
          dismissedAt={state.persistedState?.updateDismissed?.timestamp}
          onDismiss={() => state.onUpdateDismissed()}
        />
      )
    }
  />
));

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

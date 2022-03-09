import { faCode } from "@fortawesome/free-solid-svg-icons";
import { observer } from "mobx-react-lite";
import React from "react";
import ReactDOM from "react-dom";
import { LocalApi } from "./api/local";
import { WebApi } from "./api/web";
import { filePathFromComponentId } from "./component-id";
import { Preview } from "./components/Preview";
import { FilePath } from "./design/FilePath";
import { Pill } from "./design/Pill";
import { SmallLogo } from "./design/SmallLogo";
import "./index.css";
import { PreviewState } from "./PreviewState";

const state = new PreviewState(
  new LocalApi("/api/"),
  new WebApi("https://previewjs.com/api/")
);
state.start().catch(console.error);

const App = observer(() => (
  <Preview
    state={state}
    header={[
      <>
        <FilePath
          key="file"
          filePath={
            state.component?.componentId
              ? filePathFromComponentId(state.component.componentId)
              : ""
          }
        />
        <SmallLogo
          key="info"
          href="https://github.com/fwouts/previewjs/releases"
          loading={!state.appInfo}
          label={state.appInfo?.version}
        />
      </>,
      ...(state.component
        ? [
            <Pill
              key="component"
              icon={faCode}
              label={state.component.name}
              loading={!state.component.details?.variants}
              buttons={
                state.component.details?.variants?.filter(
                  (v) => !v.isEditorDriven
                ) || undefined
              }
              selectedButtonKey={state.component.variantKey}
              onClick={() => state.setVariant("custom")}
              onButtonClicked={state.setVariant.bind(state)}
            />,
          ]
        : []),
    ]}
  />
));

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

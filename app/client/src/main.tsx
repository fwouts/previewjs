import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { LocalApi } from "./api/local";
import { WebApi } from "./api/web";
import { Preview } from "./components/Preview";
import { Selection } from "./components/Selection";
import "./index.css";
import { PersistedStateController } from "./PersistedStateController";
import { PreviewState } from "./PreviewState";

const localApi = new LocalApi("/api/");
const state = new PreviewState(
  localApi,
  new WebApi("https://previewjs.com/api/"),
  new PersistedStateController(localApi)
);
state.start().catch(console.error);

const App = observer(() => {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  useEffect(() => {
    state.setIframeRef(iframeRef);
  }, [state]);
  return (
    <Preview
      state={state}
      viewport={
        <iframe className="flex-grow" ref={iframeRef} src="/preview/" />
      }
      appLabel="Preview.js"
      subheader={<Selection state={state} />}
    />
  );
});

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

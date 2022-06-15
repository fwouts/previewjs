import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { LocalApi } from "./api/local";
import { WebApi } from "./api/web";
import { Preview } from "./components/Preview";
import { Selection } from "./components/Selection";
import "./index.css";
import { PersistedStateController } from "./state/PersistedStateController";
import { PreviewState } from "./state/PreviewState";

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
      subheader={(state.component && <Selection state={state} />) || null}
    />
  );
});

const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

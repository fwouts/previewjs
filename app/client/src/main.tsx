import {
  createLocalApi,
  createWebApi,
  PersistedStateController,
  Preview,
  PreviewState,
  Selection,
} from "@previewjs/app-foundations";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";

const localApi = createLocalApi("/api/");
const state = new PreviewState(
  localApi,
  createWebApi("https://previewjs.com/api/"),
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

import { Preview } from "@previewjs/app-foundations/src/components/Preview";
import { Selection } from "@previewjs/app-foundations/src/components/Selection";
import { PersistedStateController } from "@previewjs/app-foundations/src/state/PersistedStateController";
import { PreviewState } from "@previewjs/app-foundations/src/state/PreviewState";
import { observer } from "mobx-react-lite";
import React, { useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import { LocalApi } from "../../../app-foundations/src/api/local";
import { WebApi } from "../../../app-foundations/src/api/web";
import "./index.css";

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

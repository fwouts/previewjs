import { LocalApi } from "@previewjs/app/client/src/api/local";
import { WebApi } from "@previewjs/app/client/src/api/web";
import React from "react";
import { createRoot } from "react-dom/client";
import "../../../app/client/src/index.css";
import { App } from "./App";
import "./index.css";
import { AppState } from "./state/AppState";

const state = new AppState(
  new LocalApi("/api/"),
  new WebApi("https://previewjs.com/api/")
);
const root = createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App state={state} />
  </React.StrictMode>
);
state.start().catch(console.error);

document.addEventListener("keydown", (e) => {
  const modifier = navigator.userAgent.includes("Macintosh")
    ? e.metaKey
    : e.ctrlKey;
  if (modifier && e.key === "k" && state.license.proStatus === "enabled") {
    e.preventDefault();
    state.pro.toggleSearch();
  }
});

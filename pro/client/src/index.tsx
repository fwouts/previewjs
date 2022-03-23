import { LocalApi } from "@previewjs/app/client/src/api/local";
import { WebApi } from "@previewjs/app/client/src/api/web";
import React from "react";
import ReactDOM from "react-dom";
import "../../../app/client/src/index.css";
import { App } from "./App";
import "./index.css";
import { AppState } from "./state/AppState";

const state = new AppState(
  new LocalApi("/api/"),
  new WebApi("https://previewjs.com/api/")
);
ReactDOM.render(
  <React.StrictMode>
    <App state={state} />
  </React.StrictMode>,
  document.getElementById("root")
);
state.start().catch(console.error);

document.addEventListener("keydown", (e) => {
  const modifier = navigator.userAgent.includes("Macintosh")
    ? e.metaKey
    : e.ctrlKey;
  if (modifier && e.key === "k") {
    e.preventDefault();
    state.pro.toggleSearch();
  }
});

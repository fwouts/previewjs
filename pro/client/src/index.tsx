import React from "react";
import ReactDOM from "react-dom";
import { App } from "./App";
import "./index.css";
import { AppState } from "./state/AppState";

const state = new AppState();
ReactDOM.render(
  <React.StrictMode>
    <App state={state} />
  </React.StrictMode>,
  document.getElementById("root")
);
state.start().catch(console.error);

// TODO: This used to call overrideCopyCutPaste().

// Monaco Editor raises this benign error. We should fix it at some point though!
window.addEventListener("unhandledrejection", (promiseRejectionEvent) => {
  if (
    typeof promiseRejectionEvent.reason.message === "string" &&
    promiseRejectionEvent.reason.message ===
      `Could not find source file: 'inmemory://model/1'.`
  ) {
    promiseRejectionEvent.preventDefault();
  }
  return false;
});

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

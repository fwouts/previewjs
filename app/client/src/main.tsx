import { observer } from "mobx-react-lite";
import React from "react";
import ReactDOM from "react-dom";
import { LocalApi } from "./api/local";
import { WebApi } from "./api/web";
import { Preview } from "./components/Preview";
import { Selection } from "./components/Selection";
import "./index.css";
import { PreviewState } from "./PreviewState";

const state = new PreviewState(
  new LocalApi("/api/"),
  new WebApi("https://previewjs.com/api/")
);
state.start().catch(console.error);

const App = observer(() => (
  <Preview state={state} subheader={<Selection state={state} />} />
));

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById("root")
);

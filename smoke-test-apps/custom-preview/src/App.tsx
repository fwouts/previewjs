import { setupPreviews } from "@previewjs/plugin-react/setup";
import React from "react";
import "./App.css";
import logo from "./logo.svg";

function App({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <div id="ready" className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClick}
        >
          {label}
        </a>
      </header>
    </div>
  );
}

setupPreviews(App, () => ({
  foo: {
    label: "foo",
  },
  bar: {
    label: "bar",
  },
}));

export default App;

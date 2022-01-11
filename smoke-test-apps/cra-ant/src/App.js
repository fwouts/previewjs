import { Button } from "antd";
import React from "react";
import "./App.less";
import logo from "./logo.svg";

function App() {
  return (
    <div id="ready" className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
        <Button type="primary">Button</Button>
      </header>
    </div>
  );
}

export default App;

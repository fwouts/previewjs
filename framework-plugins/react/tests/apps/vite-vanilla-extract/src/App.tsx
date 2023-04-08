import React from "react";
import {
  appHeaderStyle,
  appLinkStyle,
  appLogoStyle,
  appStyle,
} from "./App.css";
import logo from "./logo.svg";

function App() {
  return (
    <div id="ready" className={appStyle}>
      <header className={appHeaderStyle}>
        <img src={logo} className={appLogoStyle} alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className={appLinkStyle}
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;

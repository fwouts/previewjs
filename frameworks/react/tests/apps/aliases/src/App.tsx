import "App.css";
import { Button as Button1 } from "button1";
// @ts-ignore
import { Button as Button2 } from "button2";
import { Button as Button3 } from "components/Button";
import logoUrl, { ReactComponent as Logo } from "images/logo.svg";
import React from "react";
import { AppProps } from "./Proxy";

function App(props: AppProps) {
  return (
    <div id="ready" className="App">
      <header className="App-header">
        <Logo className="App-logo" />
        <img src={logoUrl} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <Button1 />
        <Button2 />
        <Button3 />
      </header>
    </div>
  );
}

export { App, AppProps };

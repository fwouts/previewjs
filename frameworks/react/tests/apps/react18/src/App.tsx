import React from "react";
import "./App.css";
import { Dependency } from "./Dependency";
import logo from "./logo.svg";
import { Foo } from "./types";

interface AppProps {
  children: React.ReactNode;
  foo: Foo;
  complex: React.DetailedHTMLProps<
    React.AnchorHTMLAttributes<HTMLAnchorElement>,
    HTMLAnchorElement
  > & {
    bar: "hi!";
  };
}

function App(_props: AppProps) {
  return (
    <div className="App">
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
        >
          Learn React
        </a>
        <Dependency />
      </header>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Other() {
  return <div className="OtherSameFile">Hello</div>;
}

export { App };

import { JSX } from "solid-js";
import "./App.css";
import { Dependency } from "./Dependency";
import logo from "./logo.svg";
import { Foo } from "./types";

interface AppProps {
  children: JSX.Element;
  foo: Foo;
  complex: JSX.AnchorHTMLAttributes<HTMLAnchorElement> & {
    bar: "hi!";
  };
}

function App(props: AppProps) {
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

export { App };

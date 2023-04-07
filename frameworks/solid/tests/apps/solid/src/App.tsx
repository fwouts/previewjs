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

function App(_props: AppProps) {
  return (
    <div class="App">
      <header class="App-header">
        <img src={logo} class="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          class="App-link"
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

function Other({ msg }: { msg: string }) {
  return <div class="OtherSameFile">{msg}</div>;
}

export { App };

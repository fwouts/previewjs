import "./App.css";
import { ComponentChildren, JSX } from "preact";
import { Dependency } from "./Dependency";
import logo from "./logo.svg";
import { Foo } from "./types";

interface AppProps {
  children: ComponentChildren;
  foo: Foo;
  complex: JSX.HTMLAttributes<HTMLAnchorElement> & {
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

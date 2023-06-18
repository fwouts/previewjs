import { action, makeObservable, observable } from "mobx";
import { useMemo } from "react";
import "./App.css";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";

class Counter {
  @observable count = 0;

  constructor() {
    makeObservable(this);
  }

  @action
  increase() {
    this.count += 1;
  }
}

function App() {
  const counter = useMemo(() => new Counter(), []);

  return (
    <>
      <div id="ready">
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={counter.increase}>count is {counter.count}</button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;

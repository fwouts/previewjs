import React, { Suspense } from "react";
import "./App.css";
import logo from "./logo.svg";

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <Suspense fallback={<div>Loading...</div>}>
          <SlowComponent />
        </Suspense>
      </header>
    </div>
  );
}

const SlowComponent = React.lazy(async () => {
  await new Promise((resolve) => setTimeout(resolve, 2500));
  return import("./Button");
});

export default App;

import "./App.css";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";

export function Greeting(props: { name: string }) {
  return (
    <div className="App">
      <div>
        <a href="https://vitejs.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://reactjs.org" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Hello, {props.name}</h1>
    </div>
  );
}

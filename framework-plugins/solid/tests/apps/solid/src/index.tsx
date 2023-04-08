/* @refresh reload */
import { render } from "solid-js/web";
import { App } from "./App";
import "./index.css";

render(
  () => <App children={null} complex={{ bar: "hi!" }} foo={{ bar: "test" }} />,
  document.getElementById("root") as HTMLElement
);

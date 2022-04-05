import type { Component } from "solid-js";
import styles from "./App.module.css";
import logo from "./logo.svg";

const App: Component = () => {
  return (
    <div class={styles.App}>
      <header class={styles.header}>
        <SolidLogo />
        <p>Hello, World!</p>
        <SolidLink label="Learn Solid" />
      </header>
    </div>
  );
};

const SolidLogo = () => <img src={logo} class={styles.logo} alt="logo" />;

const SolidLink = ({ label }: { label: string }) => {
  return (
    <a
      class={styles.link}
      href="https://github.com/solidjs/solid"
      target="_blank"
      rel="noopener noreferrer"
    >
      {label}
    </a>
  );
};

export default App;

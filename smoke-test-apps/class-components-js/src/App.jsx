import PropTypes from "prop-types";
import React from "react";
import "./App.css";
import logo from "./logo.svg";

class App extends React.Component {
  render() {
    return (
      <div id="ready" className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <p>
            Edit <code>src/App.js</code> and save to reload.
          </p>
          <a
            className="App-link"
            href="https://reactjs.org"
            target="_blank"
            rel="noopener noreferrer"
          >
            {this.props.label}
          </a>
        </header>
      </div>
    );
  }
}
App.propTypes = {
  label: PropTypes.string.isRequired,
};

export default App;

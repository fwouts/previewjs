import { BrowserRouter as Router, Link, Route, Switch } from "react-router-dom";

export default function App() {
  return (
    <Router>
      <Switch>
        <Route path="/about" component={About} />
        <Route path="/" component={Home} />
      </Switch>
    </Router>
  );
}

function Home() {
  return (
    <div id="ready">
      <h2>Home</h2>
      <Link to="/about">About</Link>
    </div>
  );
}

function About() {
  return (
    <div>
      <h2>About</h2>
      <Link to="/">Home</Link>
    </div>
  );
}

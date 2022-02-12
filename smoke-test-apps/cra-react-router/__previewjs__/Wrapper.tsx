import { BrowserRouter as Router } from "react-router-dom";
import "../src/index.css";

export const Wrapper: React.FC = ({ children }) => {
  return <Router>{children}</Router>;
};

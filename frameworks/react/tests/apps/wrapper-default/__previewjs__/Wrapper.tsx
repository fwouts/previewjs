import React from "react";

export const Wrapper: React.FunctionComponent = ({ children }) => {
  return <div style={{ border: "10px solid #f00" }}>{children}</div>;
};

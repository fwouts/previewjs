import { keyframes, style } from "@vanilla-extract/css";

// TODO: Use "const" instead of "var".
// As of Feb 2023, this seems to trigger an error with esbuild trying to target es5 for some reason.

export var appStyle = style({
  textAlign: "center",
});

var appLogoSpin = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

export var appLogoStyle = style({
  height: "40vmin",
  pointerEvents: "none",
  animation: `${appLogoSpin} infinite 20s linear`,
});

export var appHeaderStyle = style({
  backgroundColor: "#282c34",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "calc(10px + 2vmin)",
  color: "white",
});

export var appLinkStyle = style({
  color: "#61dafb",
});

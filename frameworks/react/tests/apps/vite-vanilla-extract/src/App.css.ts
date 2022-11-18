import { keyframes, style } from "@vanilla-extract/css";

export const appStyle = style({
  textAlign: "center",
});

const appLogoSpin = keyframes({
  from: { transform: "rotate(0deg)" },
  to: { transform: "rotate(360deg)" },
});

export const appLogoStyle = style({
  height: "40vmin",
  pointerEvents: "none",
  animation: `${appLogoSpin} infinite 20s linear`,
});

export const appHeaderStyle = style({
  backgroundColor: "#282c34",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "calc(10px + 2vmin)",
  color: "white",
});

export const appLinkStyle = style({
  color: "#61dafb",
});

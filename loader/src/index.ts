// Initialise __non_webpack_require__ for non-webpack environments.
if (!global.__non_webpack_require__) {
  global.__non_webpack_require__ = require;
}

export type LogLevel = "silent" | "error" | "warn" | "info";

export { install, isInstalled } from "./installer";
export { init, load } from "./runner";

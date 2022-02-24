export type LogLevel = "silent" | "error" | "warn" | "info";

export { install, isInstalled } from "./installer";
export { init, load } from "./runner";

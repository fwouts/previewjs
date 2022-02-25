import path from "path";
import { Component, Workspace } from ".";

export function generateComponentId(
  workspace: Workspace,
  component: Component
) {
  return `${path
    .relative(workspace.rootDirPath, component.filePath)
    .replace(/\\/g, "/")}:${component.name}`;
}

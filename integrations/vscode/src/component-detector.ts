import type { AnalyzeFileResponse, Client } from "@previewjs/daemon/client";
import type vscode from "vscode";
import { WorkspaceGetter } from "./workspaces";

export function createComponentDetector(
  client: Client,
  getWorkspaceId: WorkspaceGetter
): ComponentDetector {
  return async function (
    document?: vscode.TextDocument
  ): Promise<AnalyzeFileResponse["components"]> {
    if (!document || !document.fileName) {
      return [];
    }
    const workspaceId = await getWorkspaceId(document);
    if (!workspaceId) {
      return [];
    }
    const { components } = await client.analyzeFile({
      workspaceId,
      absoluteFilePath: document.fileName,
    });
    return components;
  };
}

export type ComponentDetector = (
  document?: vscode.TextDocument
) => Promise<AnalyzeFileResponse["components"]>;

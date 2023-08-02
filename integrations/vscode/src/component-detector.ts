import type { AnalyzeFileResponse, Client } from "@previewjs/daemon/client";
import type vscode from "vscode";
import type { WorkspaceGetter } from "./workspaces";

export function createComponentAnalyzer(
  client: Client,
  getWorkspaceId: WorkspaceGetter,
  pendingFileChanges: Map<string, string>
): ComponentAnalyzer {
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
    const pendingText = pendingFileChanges.get(document.fileName);
    if (pendingText !== undefined) {
      pendingFileChanges.delete(document.fileName);
      await client.updatePendingFile({
        absoluteFilePath: document.fileName,
        utf8Content: pendingText,
      });
    }
    const { components } = await client.analyzeFile({
      workspaceId,
      absoluteFilePath: document.fileName,
    });
    return components;
  };
}

export type ComponentAnalyzer = (
  document?: vscode.TextDocument
) => Promise<AnalyzeFileResponse["components"]>;

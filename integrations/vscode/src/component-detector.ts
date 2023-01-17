import type { AnalyzeFileResponse, Client } from "@previewjs/daemon/client";
import type vscode from "vscode";
import type { createWorkspaceGetter } from "./workspaces";

export function createComponentDetector(
  previewjsInitPromise: Promise<Client | null>,
  getWorkspaceId: ReturnType<typeof createWorkspaceGetter>
) {
  async function getComponents(
    document?: vscode.TextDocument
  ): Promise<AnalyzeFileResponse["components"]> {
    if (!document || !document.fileName) {
      return [];
    }
    const previewjsClient = await previewjsInitPromise;
    if (!previewjsClient) {
      return [];
    }
    const workspaceId = await getWorkspaceId(previewjsClient, document);
    if (!workspaceId) {
      return [];
    }
    const { components } = await previewjsClient.analyzeFile({
      workspaceId,
      absoluteFilePath: document.fileName,
    });
    return components;
  }

  return {
    getComponents,
  };
}

import type { Client, CrawlFileResponse } from "@previewjs/daemon/client";
import type vscode from "vscode";
import type { WorkspaceGetter } from "./workspaces.js";

export function createFileAnalyzer(
  client: Client,
  getWorkspaceId: WorkspaceGetter,
  pendingFileChanges: Map<string, string>
): FileAnalyzer {
  return async function (
    document?: vscode.TextDocument
  ): Promise<CrawlFileResponse["previewables"]> {
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
    const { previewables } = await client.crawlFile({
      workspaceId,
      absoluteFilePath: document.fileName,
    });
    return previewables;
  };
}

export type FileAnalyzer = (
  document?: vscode.TextDocument
) => Promise<CrawlFileResponse["previewables"]>;

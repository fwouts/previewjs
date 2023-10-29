import type { Client, CrawlFileResponse } from "@previewjs/daemon/client";
import type vscode from "vscode";

export function createFileAnalyzer(
  client: Client,
  pendingFileChanges: Map<string, string>
): FileAnalyzer {
  return async function (
    document?: vscode.TextDocument
  ): Promise<CrawlFileResponse> {
    if (!document || !document.fileName) {
      return {
        rootDir: null,
        previewables: [],
      };
    }
    const pendingText = pendingFileChanges.get(document.fileName);
    if (pendingText !== undefined) {
      pendingFileChanges.delete(document.fileName);
      await client.updatePendingFile({
        absoluteFilePath: document.fileName,
        utf8Content: pendingText,
      });
    }
    return client.crawlFile({
      absoluteFilePath: document.fileName,
    });
  };
}

export type FileAnalyzer = (
  document?: vscode.TextDocument
) => Promise<CrawlFileResponse>;

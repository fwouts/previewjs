import type { Client } from "@previewjs/server/client";
import path from "path";
import type vscode from "vscode";
import type { OutputChannel } from "vscode";

export function createWorkspaceGetter(outputChannel: OutputChannel) {
  const workspaceIds = new Set<string>();

  return async function (
    previewjsClient: Client,
    document: vscode.TextDocument
  ) {
    if (!path.isAbsolute(document.fileName)) {
      return null;
    }
    const workspace = await previewjsClient.getWorkspace({
      absoluteFilePath: document.fileName,
    });
    if (!workspace.workspaceId) {
      return null;
    }
    if (!workspaceIds.has(workspace.workspaceId)) {
      outputChannel.appendLine(
        `✨ Created Preview.js workspace for: ${workspace.rootDirPath}`
      );
      workspaceIds.add(workspace.workspaceId);
    }
    return workspace.workspaceId;
  };
}

import type { Client } from "@previewjs/daemon/client";
import path from "path";
import type vscode from "vscode";
import type { OutputChannel } from "vscode";

export function createWorkspaceGetter(
  client: Client,
  outputChannel: OutputChannel,
  workspaces: Workspaces
): WorkspaceGetter {
  return async function (document: vscode.TextDocument) {
    if (!path.isAbsolute(document.fileName)) {
      return null;
    }
    const workspace = await client.getWorkspace({
      absoluteFilePath: document.fileName,
    });
    if (!workspace.workspaceId) {
      return null;
    }
    if (!workspaces[workspace.workspaceId]) {
      outputChannel.appendLine(
        `✨ Created Preview.js workspace for: ${workspace.rootDir}`
      );
      workspaces[workspace.workspaceId] = workspace.rootDir;
    }
    return workspace.workspaceId;
  };
}

export type Workspaces = Record<string /* workspaceId */, string /* rootDir */>;

export type WorkspaceGetter = (
  document: vscode.TextDocument
) => Promise<string | null>;

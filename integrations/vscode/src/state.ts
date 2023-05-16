import type { Client } from "@previewjs/daemon/client";
import vscode from "vscode";
import type { ComponentDetector } from "./component-detector";
import { createComponentDetector } from "./component-detector";
import { ensureDaemonRunning } from "./start-daemon";
import type { Workspaces } from "./workspaces";
import { createWorkspaceGetter } from "./workspaces";

export async function createState({
  outputChannel,
}: {
  outputChannel: vscode.OutputChannel;
}): Promise<PreviewJsState | null> {
  const daemon = await ensureDaemonRunning(outputChannel)
    .catch((e) => {
      outputChannel.appendLine(e.stack);
      return null;
    })
    .then((p) => {
      if (!p) {
        outputChannel.appendLine("Preview.js daemon could not be started.");
        outputChannel.show();
        return null;
      }
      return p;
    });

  if (!daemon) {
    return null;
  }

  const workspaces: Workspaces = {};
  const getWorkspaceId = createWorkspaceGetter(
    daemon.client,
    outputChannel,
    workspaces
  );
  const getComponents = createComponentDetector(daemon.client, getWorkspaceId);
  const state: PreviewJsState = {
    client: daemon.client,
    dispose: () => {
      daemon.watcher.close();
      if (state.previewPanel) {
        state.previewPanel.dispose();
        state.previewPanel = null;
      }
    },
    workspaces,
    getComponents,
    getWorkspaceId,
    previewPanel: null,
    currentPreview: null,
  };
  return state;
}

export type PreviewJsState = {
  client: Client;
  dispose: () => void;
  workspaces: Workspaces;
  previewPanel: vscode.WebviewPanel | null;
  currentPreview: {
    workspaceId: string;
    url: string;
  } | null;
  getComponents: ComponentDetector;
  getWorkspaceId: (document: vscode.TextDocument) => Promise<string | null>;
};

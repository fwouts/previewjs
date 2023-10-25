import type { Client } from "@previewjs/daemon/client";
import vscode from "vscode";
import type { FileAnalyzer } from "./file-analyzer";
import { createFileAnalyzer } from "./file-analyzer";
import { closePreviewPanel } from "./preview-panel";
import { ensureDaemonRunning } from "./start-daemon";
import type { Workspaces } from "./workspaces";
import { createWorkspaceGetter } from "./workspaces";

const PING_INTERVAL_MILLIS = 1000;

export async function createState({
  outputChannel,
  runningServerStatusBarItem,
  onDispose,
}: {
  outputChannel: vscode.OutputChannel;
  runningServerStatusBarItem: vscode.StatusBarItem;
  onDispose: () => void;
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

  const regularPing = setInterval(async () => {
    if (daemon.daemonProcess.exitCode !== null) {
      outputChannel.appendLine(
        `Preview.js daemon is no longer running (exit code ${daemon.daemonProcess.exitCode}). Was it killed?`
      );
      state.dispose();
      return;
    }
    if (state.currentPreview) {
      const status = await state.client.checkPreviewStatus({
        workspaceId: state.currentPreview.workspaceId,
      });
      if (!status.running) {
        state.currentPreview = null;
        runningServerStatusBarItem.hide();
        closePreviewPanel(state);
      }
    }
  }, PING_INTERVAL_MILLIS);

  const workspaces: Workspaces = {};
  const getWorkspaceId = createWorkspaceGetter(
    daemon.client,
    outputChannel,
    workspaces
  );
  const pendingFileChanges = new Map<string, string>();
  const crawlFile = createFileAnalyzer(
    daemon.client,
    getWorkspaceId,
    pendingFileChanges
  );
  const state: PreviewJsState = {
    client: daemon.client,
    dispose: () => {
      onDispose();
      clearInterval(regularPing);
      daemon.watcher.close();
      if (state.previewPanel) {
        state.previewPanel.dispose();
        state.previewPanel = null;
      }
    },
    workspaces,
    pendingFileChanges,
    crawlFile,
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
  pendingFileChanges: Map<string, string>;
  previewPanel: vscode.WebviewPanel | null;
  currentPreview: {
    workspaceId: string;
    url: string;
  } | null;
  crawlFile: FileAnalyzer;
  getWorkspaceId: (document: vscode.TextDocument) => Promise<string | null>;
};

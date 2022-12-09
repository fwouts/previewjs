import type { AnalyzeFileResponse, Client } from "@previewjs/daemon/client";
import { exclusivePromiseRunner } from "exclusive-promises";
import type vscode from "vscode";
import type { createWorkspaceGetter } from "./workspaces";

export function createComponentDetector(
  previewjsInitPromise: Promise<Client | null>,
  getWorkspaceId: ReturnType<typeof createWorkspaceGetter>
) {
  const componentsByFilePath = new Map<
    string,
    AnalyzeFileResponse["components"]
  >();

  function invalidateCache(document?: vscode.TextDocument) {
    if (!document) {
      return;
    }
    componentsByFilePath.delete(document.fileName);
  }

  const exclusiveRunner = exclusivePromiseRunner();
  async function getComponents(
    document?: vscode.TextDocument
  ): Promise<AnalyzeFileResponse["components"]> {
    if (!document) {
      return [];
    }
    const existingComponents = componentsByFilePath.get(document.fileName);
    if (existingComponents) {
      return existingComponents;
    }
    return exclusiveRunner(async () => {
      const components = await runComponentDetectionForDocument(document);
      componentsByFilePath.set(document.fileName, components);
      return components;
    });
  }

  async function runComponentDetectionForDocument(
    document: vscode.TextDocument
  ): Promise<AnalyzeFileResponse["components"]> {
    if (!document.fileName) {
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
    invalidateCache,
    getComponents,
  };
}

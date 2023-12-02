import { exclusivePromiseRunner } from "exclusive-promises";
import vscode from "vscode";
import type { PreviewJsState } from "./state.js";

const locking = exclusivePromiseRunner();

export function isPreviewServerRunning(state: PreviewJsState, rootDir: string) {
  // Note: keep this in sync with the check in ensurePreviewServerStarted().
  return state.currentPreview?.rootDir === rootDir;
}

export async function ensurePreviewServerStarted(
  state: PreviewJsState,
  rootDir: string
) {
  return locking(async () => {
    // Note: keep this in sync with isPreviewServerRunning().
    // This is inlined because it allows TypeScript to keep more type information.
    if (state.currentPreview?.rootDir !== rootDir) {
      if (state.currentPreview) {
        await state.client.stopPreview({
          rootDir: state.currentPreview.rootDir,
        });
      }
      const { url } = await state.client.startPreview({
        rootDir,
        ...(vscode.env.uiKind === vscode.UIKind.Web
          ? {
              // GitHub Codespaces
              clientPort: 443,
            }
          : {}),
      });
      const remoteCompatibleUrl = await vscode.env
        .asExternalUri(vscode.Uri.parse(url))
        .then((uri) => uri.toString());
      state.currentPreview = {
        rootDir,
        url: remoteCompatibleUrl,
      };
    }
    return state.currentPreview;
  });
}

export async function ensurePreviewServerStopped(state: PreviewJsState) {
  return locking(async () => {
    if (!state.currentPreview) {
      return;
    }
    await state.client.stopPreview({
      rootDir: state.currentPreview.rootDir,
    });
    state.currentPreview = null;
  });
}

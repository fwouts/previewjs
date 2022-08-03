import type { Preview, Workspace } from "@previewjs/core";
import { exclusivePromiseRunner } from "exclusive-promises";

let currentPreview:
  | {
      workspace: Workspace;
      preview: Preview;
    }
  | undefined = undefined;

const locking = exclusivePromiseRunner();
export async function ensurePreviewServerStarted(workspace: Workspace) {
  return locking(async () => {
    if (currentPreview?.workspace !== workspace) {
      if (currentPreview) {
        await currentPreview.preview.stop();
      }
      currentPreview = {
        workspace,
        preview: await workspace.preview.start(),
      };
    }
    return currentPreview.preview;
  });
}

export async function ensurePreviewServerStopped() {
  return locking(async () => {
    if (!currentPreview) {
      return;
    }
    await currentPreview.preview.stop({
      onceUnused: true,
    });
    currentPreview = undefined;
  });
}

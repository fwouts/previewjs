import type { Client } from "@previewjs/daemon/client";
import { exclusivePromiseRunner } from "exclusive-promises";

let currentPreview:
  | {
      workspaceId: string;
      url: string;
    }
  | undefined = undefined;

const locking = exclusivePromiseRunner();
export async function ensurePreviewServerStarted(
  client: Client,
  workspaceId: string
) {
  return locking(async () => {
    if (currentPreview?.workspaceId !== workspaceId) {
      if (currentPreview) {
        await client.stopPreview({
          workspaceId: currentPreview.workspaceId,
        });
      }
      const { url } = await client.startPreview({
        workspaceId,
      });
      currentPreview = {
        workspaceId,
        url,
      };
    }
    return currentPreview;
  });
}

export async function ensurePreviewServerStopped(client: Client) {
  return locking(async () => {
    if (!currentPreview) {
      return;
    }
    await client.stopPreview({
      workspaceId: currentPreview.workspaceId,
    });
    currentPreview = undefined;
  });
}

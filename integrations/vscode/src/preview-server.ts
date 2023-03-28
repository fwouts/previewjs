import { exclusivePromiseRunner } from "exclusive-promises";
import { PreviewJsState } from "./state";

const locking = exclusivePromiseRunner();
export async function ensurePreviewServerStarted(
  state: PreviewJsState,
  workspaceId: string
) {
  return locking(async () => {
    if (state.currentPreview?.workspaceId !== workspaceId) {
      if (state.currentPreview) {
        await state.client.stopPreview({
          workspaceId: state.currentPreview.workspaceId,
        });
      }
      const { url } = await state.client.startPreview({
        workspaceId,
      });
      state.currentPreview = {
        workspaceId,
        url,
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
      workspaceId: state.currentPreview.workspaceId,
    });
    state.currentPreview = null;
  });
}

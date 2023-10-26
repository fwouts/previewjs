import { exclusivePromiseRunner } from "exclusive-promises";
import type { PreviewJsState } from "./state";

const locking = exclusivePromiseRunner();
export async function ensurePreviewServerStarted(
  state: PreviewJsState,
  rootDir: string
) {
  return locking(async () => {
    if (state.currentPreview?.rootDir !== rootDir) {
      if (state.currentPreview) {
        await state.client.stopPreview({
          rootDir: state.currentPreview.rootDir,
        });
      }
      const { url } = await state.client.startPreview({
        rootDir,
      });
      state.currentPreview = {
        rootDir,
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
      rootDir: state.currentPreview.rootDir,
    });
    state.currentPreview = null;
  });
}

import type { PreviewIframeState } from "@previewjs/iframe";
import type { Page } from "playwright";

export async function setupPreviewStateListener(
  page: Page,
  listener: (state: PreviewIframeState) => void
) {
  let state: PreviewIframeState = {
    loading: false,
    rendered: false,
    errors: [],
    logs: [],
    actions: [],
  };
  await page.exposeFunction(
    "onIframeStateUpdate",
    (newState: PreviewIframeState) => {
      state = newState;
      listener(state);
    }
  );
  return () => state;
}

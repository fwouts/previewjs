import type { PreviewEvent } from "@previewjs/iframe";
import type { Page } from "playwright";

export async function setupPreviewEventListener(
  page: Page,
  listener: (event: PreviewEvent) => void
) {
  await page.exposeFunction("onIframeEvent", listener);
}

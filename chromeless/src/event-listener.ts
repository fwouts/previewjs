import type { PreviewEvent } from "@previewjs/iframe";
import type { Page } from "playwright";

export async function setupPreviewEventListener(
  page: Page,
  listener: (event: PreviewEvent) => void
) {
  let recorded: PreviewEvent[] = [];
  const events = {
    clear() {
      recorded = [];
    },
    get() {
      return [...recorded];
    },
  };
  await page.exposeFunction("onIframeEvent", (event: PreviewEvent) => {
    recorded.push(event);
    listener(event);
  });
  return events;
}

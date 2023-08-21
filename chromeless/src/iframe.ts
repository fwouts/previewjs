import type playwright from "playwright";

export async function getPreviewIframe(page: playwright.Page) {
  let iframe: playwright.ElementHandle<Element> | null = null;
  let frame: playwright.Frame | null = null;
  while (!frame) {
    iframe = await page.waitForSelector("iframe", {
      state: "attached",
    });
    if (iframe) {
      frame = await iframe.contentFrame();
    }
  }
  await frame.waitForLoadState("networkidle");
  return frame;
}

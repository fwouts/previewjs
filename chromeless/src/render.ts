import type { Page } from "playwright";
import type { Component } from "../client/src";
import { getPreviewIframe } from "./iframe";

export async function render(page: Page, component: Component) {
  await page.waitForLoadState("networkidle");
  try {
    await (await getPreviewIframe(page)).waitForLoadState("networkidle");
  } catch (e) {
    // It's OK for the iframe to be replaced by another one, in which case wait again.
    await (await getPreviewIframe(page)).waitForLoadState("networkidle");
  }
  await page.evaluate((component) => {
    window.renderComponent(component);
  }, component);
}

import { expect, testSuite } from "@previewjs/app/testing";
import { elements } from "./elements";

export const sidePanelTests = testSuite("side panel", (test) => {
  test("shows side panel", "react", async ({ controller }) => {
    const { sidePanel } = elements(controller);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await sidePanel.toggle.click();
    await sidePanel.dir.get("src").waitUntilVisible();
    await sidePanel.file.get("App.tsx").waitUntilVisible();
    expect(await sidePanel.file.selected().text()).toEqual("App.tsx");
  });

  test("switches to another file", "react", async ({ controller }) => {
    const { sidePanel } = elements(controller);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await sidePanel.toggle.click();
    await sidePanel.file.get("Other.tsx").waitUntilVisible();
    await sidePanel.file.get("Other.tsx").click();
    await previewIframe.waitForSelector(".Other");
    expect(await sidePanel.file.selected().text()).toEqual("Other.tsx");
  });
});

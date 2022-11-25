import test, { expect } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const testApp = path.join(__dirname, "apps", "vue3");

test.describe("vue3/action logs", () => {
  const test = previewTest([pluginFactory], testApp);

  test("shows action logs on link click", async (preview) => {
    await preview.fileManager.update(
      "src/App.vue",
      `<template>
        <a id="link" href="https://www.google.com">
          Hello, World!
        </a>
      </template>`
    );
    await preview.show("src/App.vue:App");
    const link = await preview.iframe.waitForSelector("#link");
    preview.events.clear();
    await link.click();
    expect(preview.events.get()).toEqual([
      {
        kind: "action",
        path: "https://www.google.com/",
        type: "url",
      },
    ]);
  });
});

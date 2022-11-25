import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const WRAPPER_SOURCE = `<template>
  <div class="wrapped">
    <slot />
  </div>
</template>
`;

const testApp = path.join(__dirname, "apps", "vue2");

test.describe("vue2/wrapper", () => {
  const test = previewTest([pluginFactory], testApp);

  test("refreshes when wrapper is added", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector("#app");
    await preview.iframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
    await preview.fileManager.update(
      "__previewjs__/Wrapper.vue",
      WRAPPER_SOURCE
    );
    await preview.iframe.waitForSelector(".wrapped");
  });

  test("refreshes when wrapper is updated", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector("#app");
    await preview.iframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
    await preview.fileManager.update(
      "__previewjs__/Wrapper.vue",
      WRAPPER_SOURCE
    );
    await preview.iframe.waitForSelector(".wrapped");
    await preview.fileManager.update("__previewjs__/Wrapper.vue", {
      replace: /wrapped/g,
      with: "wrapped-modified",
    });
    await preview.iframe.waitForSelector(".wrapped-modified");
  });

  test("refreshes when wrapper is removed", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector("#app");
    await preview.iframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
    await preview.fileManager.update(
      "__previewjs__/Wrapper.vue",
      WRAPPER_SOURCE
    );
    await preview.iframe.waitForSelector(".wrapped");
    await preview.fileManager.remove("__previewjs__/Wrapper.vue");
    await preview.iframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
  });
});

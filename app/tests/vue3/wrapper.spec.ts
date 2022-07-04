import vue3Plugin from "@previewjs/plugin-vue3";
import { describe, it } from "vitest";

const WRAPPER_SOURCE = `<template>
  <div class="wrapped">
    <slot />
  </div>
</template>
`;

describe("vue3/wrapper", () => {
  it("refreshes when wrapper is added", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await controller.show("src/App.vue:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".logo");
    await previewIframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
    await appDir.update("__previewjs__/Wrapper.vue", {
      kind: "replace",
      text: WRAPPER_SOURCE,
    });
    await previewIframe.waitForSelector(".wrapped");
  });

  it("refreshes when wrapper is updated", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await controller.show("src/App.vue:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".logo");
    await appDir.update("__previewjs__/Wrapper.vue", {
      kind: "replace",
      text: WRAPPER_SOURCE,
    });
    await previewIframe.waitForSelector(".wrapped");
    await appDir.update("__previewjs__/Wrapper.vue", {
      kind: "edit",
      search: /wrapped/g,
      replace: "wrapped-modified",
    });
    await previewIframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
    await previewIframe.waitForSelector(".wrapped-modified");
  });

  it("refreshes when wrapper is removed", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await controller.show("src/App.vue:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".logo");
    await appDir.update("__previewjs__/Wrapper.vue", {
      kind: "replace",
      text: WRAPPER_SOURCE,
    });
    await previewIframe.waitForSelector(".wrapped");
    await appDir.remove("__previewjs__/Wrapper.vue");
    await previewIframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
  });
});

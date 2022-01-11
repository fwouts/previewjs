import { testSuite } from "../../testing";

const WRAPPER_SOURCE = `<template>
  <div class="wrapped">
    <slot />
  </div>
</template>
`;

export const wrapperTests = testSuite("vue3/wrapper", (test) => {
  test(
    "refreshes when wrapper is added",
    "vue3",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "refreshes when wrapper is updated",
    "vue3",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "refreshes when wrapper is removed",
    "vue3",
    async ({ appDir, controller }) => {
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
    }
  );
});

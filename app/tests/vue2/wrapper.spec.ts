import { testSuite } from "@previewjs/e2e-test-runner";
import vue2Plugin from "@previewjs/plugin-vue2";

const WRAPPER_SOURCE = `<template>
  <div class="wrapped">
    <slot />
  </div>
</template>
`;

export const wrapperTests = testSuite([vue2Plugin], "vue2/wrapper", (test) => {
  test(
    "refreshes when wrapper is added",
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#app");
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
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#app");
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
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#app");
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

import { testSuite } from "@previewjs/e2e-test-runner";
import sveltePlugin from "@previewjs/plugin-svelte";

const WRAPPER_SOURCE = `<div class="wrapped">
  <slot />
</div>
`;

export const wrapperTests = testSuite(
  [sveltePlugin],
  "svelte/wrapper",
  (test) => {
    test(
      "refreshes when wrapper is added",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await previewIframe.waitForSelector(".wrapped", {
          state: "hidden",
        });
        await appDir.update("__previewjs__/Wrapper.svelte", {
          kind: "replace",
          text: WRAPPER_SOURCE,
        });
        await previewIframe.waitForSelector(".wrapped");
      }
    );

    test(
      "refreshes when wrapper is updated",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await appDir.update("__previewjs__/Wrapper.svelte", {
          kind: "replace",
          text: WRAPPER_SOURCE,
        });
        await previewIframe.waitForSelector(".wrapped");
        await appDir.update("__previewjs__/Wrapper.svelte", {
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
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await appDir.update("__previewjs__/Wrapper.svelte", {
          kind: "replace",
          text: WRAPPER_SOURCE,
        });
        await previewIframe.waitForSelector(".wrapped");
        await appDir.remove("__previewjs__/Wrapper.svelte");
        await previewIframe.waitForSelector(".wrapped", {
          state: "hidden",
        });
      }
    );
  }
);

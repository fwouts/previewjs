import vue2Plugin from "@previewjs/plugin-vue2";
import { testSuite } from "../../testing";
import { expectErrors } from "../../testing/helpers/expect-errors";

export const errorHandlingTests = testSuite(
  [vue2Plugin],
  "vue2/error handling",
  (test) => {
    test(
      "handles syntax errors gracefully when props untouched",
      "vue2",
      async ({ appDir, controller }) => {
        await controller.show("src/App.vue:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector("#app");
        await previewIframe.waitForSelector("img");
        await appDir.update("src/App.vue", {
          kind: "edit",
          search: /<img .*\/>/g,
          replace: "<img",
        });
        await sleep(2);
        // We don't expect to see any errors.
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("img", { state: "hidden" });
        // The rest of the component should still be shown.
        await previewIframe.waitForSelector("#app");
      }
    );

    test(
      "handles syntax errors gracefully when props updated",
      "vue2",
      async ({ appDir, controller }) => {
        await controller.show("src/App.vue:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector("#app");
        await controller.props.editor.isReady();
        await controller.props.editor.replaceText(`
      properties = { foo: "bar" };
      `);
        await previewIframe.waitForSelector("#app");
        await appDir.update("src/App.vue", {
          kind: "edit",
          search: /<img .*\/>/g,
          replace: "<img",
        });
        await sleep(2);
        // We don't expect to see any errors.
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("img", { state: "hidden" });
        // The rest of the component should still be shown.
        await previewIframe.waitForSelector("#app");
      }
    );

    test(
      "recovers correctly after encountering broken imports",
      "vue2",
      async ({ appDir, controller }) => {
        await controller.show("src/App.vue:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector("#app");
        await previewIframe.waitForSelector(".hello");
        await appDir.update(
          "src/App.vue",
          {
            kind: "edit",
            search: "components/HelloWorld.vue",
            replace: "components/Broken.vue",
          },
          {
            inMemoryOnly: true,
          }
        );
        await expectErrors(controller, [
          "Failed to reload /src/App.vue. This could be due to syntax errors or importing non-existent modules.",
        ]);
        await previewIframe.waitForSelector("#app");
        await previewIframe.waitForSelector(".hello");
        await appDir.update(
          "src/App.vue",
          {
            kind: "edit",
            search: "components/Broken.vue",
            replace: "components/HelloWorld.vue",
          },
          {
            inMemoryOnly: true,
          }
        );
        await appDir.update(
          "src/components/HelloWorld.vue",
          {
            kind: "edit",
            search: `class="hello"`,
            replace: `class="greetings"`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await expectErrors(controller, []);
        await previewIframe.waitForSelector("#app");
        await previewIframe.waitForSelector(".greetings");
      }
    );

    test(
      "fails correctly when encountering broken CSS",
      "vue2",
      async ({ appDir, controller }) => {
        await controller.show("src/App.vue:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector("#app");
        await appDir.update("src/App.vue", {
          kind: "edit",
          search: "#app {",
          replace: " BROKEN",
        });
        await expectErrors(controller, [
          `Failed to reload /src/App.vue?vue&type=style&index=0&lang.css. This could be due to syntax errors or importing non-existent modules.`,
        ]);
        await appDir.update("src/App.vue", {
          kind: "edit",
          search: " BROKEN",
          replace: "#app {",
        });
        await expectErrors(controller, []);
      }
    );

    test(
      "shows error when file is missing before update",
      "vue2",
      async ({ controller }) => {
        await controller.show("src/AppMissing.vue:AppMissing");
        await expectErrors(controller, [
          `Failed to resolve import "/src/AppMissing.vue"`,
          "Failed to fetch dynamically imported module",
        ]);
      }
    );

    test(
      "shows error when file is missing after update",
      "vue2",
      async ({ appDir, controller }) => {
        await controller.show("src/App.vue:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector("#app");
        await appDir.rename("src/App.vue", "src/App-renamed.vue");
        await expectErrors(controller, [
          // TODO: Consider replacing error message.
          `/src/App.vue has no corresponding SFC entry in the cache. This is a vite-plugin-vue2 internal error, please open an issue`,
          "Failed to reload /src/App.vue",
          "Failed to reload /src/App.vue",
        ]);
      }
    );
  }
);

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

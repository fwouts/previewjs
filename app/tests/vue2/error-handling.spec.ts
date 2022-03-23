import path from "path";
import { expect, testSuite } from "../../testing";

export const errorHandlingTests = testSuite("vue2/error handling", (test) => {
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
      await controller.errors.title.waitUntilGone();
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
      await controller.errors.title.waitUntilGone();
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
      await sleep(2);
      // We don't expect to see an error.
      await controller.errors.title.waitUntilGone();
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
      await sleep(2);
      await controller.errors.title.waitUntilGone();
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
      await sleep(2);
      expect(await controller.errors.title.text()).toContain(
        `CssSyntaxError: ${path.join(appDir.rootPath, "src/App.vue")}`
      );
      await appDir.update("src/App.vue", {
        kind: "edit",
        search: " BROKEN",
        replace: "#app {",
      });
      await controller.errors.title.waitUntilGone();
    }
  );
});

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

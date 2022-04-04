import path from "path";
import { expect, testSuite } from "../../testing";

export const errorHandlingTests = testSuite("vue3/error handling", (test) => {
  test(
    "handles syntax errors gracefully when props untouched",
    "vue3",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".logo");
      await previewIframe.waitForSelector("img");
      await appDir.update("src/App.vue", {
        kind: "edit",
        search: /<img .*\/>/g,
        replace: "<img",
      });
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Attribute name cannot contain U+0022 ("), U+0027 ('), and U+003C (<)`
      );
      // The component should still be shown.
      await previewIframe.waitForSelector(".logo");
    }
  );

  test(
    "handles syntax errors gracefully when props updated",
    "vue3",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".logo");
      await controller.props.editor.isReady();
      await controller.props.editor.replaceText(`
      properties = { foo: "bar" };
      `);
      await previewIframe.waitForSelector(".logo");
      await appDir.update("src/App.vue", {
        kind: "edit",
        search: /<img .*\/>/g,
        replace: "<img",
      });
      await sleep(2);
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `Attribute name cannot contain U+0022 ("), U+0027 ('), and U+003C (<)`
      );
      // The component should still be shown.
      await previewIframe.waitForSelector(".logo");
    }
  );

  test(
    "recovers correctly after encountering broken imports",
    "vue3",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".logo");
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
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        "Failed to reload /src/App.vue. This could be due to syntax errors or importing non-existent modules."
      );
      await previewIframe.waitForSelector(".logo");
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
      await previewIframe.waitForSelector(".logo");
      await previewIframe.waitForSelector(".greetings");
    }
  );

  test(
    "fails correctly when encountering broken CSS",
    "vue3",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".logo");
      await appDir.update("src/App.vue", {
        kind: "edit",
        search: "#app {",
        replace: " BROKEN",
      });
      await sleep(2);
      expect(await controller.errors.title.text()).toEqual(
        `${path
          .join(appDir.rootPath, "src/App.vue")
          .replace(/\\/g, "/")}:3:3: Unknown word`
      );
      await appDir.update("src/App.vue", {
        kind: "edit",
        search: " BROKEN",
        replace: "#app {",
      });
      await controller.errors.title.waitUntilGone();
    }
  );

  test(
    "shows error when file is missing before update",
    "vue3",
    async ({ controller }) => {
      await controller.show("src/AppMissing.vue:AppMissing");
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toStartWith(
        `Failed to resolve import "/src/AppMissing.vue"`
      );
    }
  );

  test(
    "shows error when file is missing after update",
    "vue3",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".logo");
      await appDir.rename("src/App.vue", "src/App-renamed.vue");
      await controller.errors.title.waitUntilVisible();
      expect(await controller.errors.title.text()).toEqual(
        `ENOENT: no such file or directory, open '/src/App.vue'`
      );
    }
  );
});

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

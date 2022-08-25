import { expectErrors, testSuite } from "@previewjs/e2e-test-runner";
import vue3Plugin from "@previewjs/plugin-vue3";
import path from "path";

export const errorHandlingTests = testSuite(
  [vue3Plugin],
  "vue3/error handling",
  (test) => {
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
        await expectErrors(controller, [
          `Attribute name cannot contain U+0022 ("), U+0027 ('), and U+003C (<)`,
          "Failed to reload /src/App.vue. This could be due to syntax errors or importing non-existent modules.",
        ]);
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
        await expectErrors(controller, [
          `Attribute name cannot contain U+0022 ("), U+0027 ('), and U+003C (<)`,
          "Failed to reload /src/App.vue. This could be due to syntax errors or importing non-existent modules.",
        ]);
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
        await expectErrors(controller, [
          "Failed to reload /src/App.vue. This could be due to syntax errors or importing non-existent modules.",
        ]);
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
        await controller.waitForExpectedIframeRefresh();
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
        await expectErrors(controller, [
          `${path
            .join(appDir.rootPath, "src/App.vue")
            .replace(/\\/g, "/")}:3:3: Unknown word`,
          " Failed to reload /src/App.vue?vue&type=style&index=0&lang.css. This could be due to syntax errors or importing non-existent modules.",
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
      "vue3",
      async ({ controller }) => {
        await controller.show("src/AppMissing.vue:AppMissing", {
          expectMissing: true,
        });
        await expectErrors(controller, [
          `Failed to resolve import "/src/AppMissing.vue"`,
          "Failed to fetch dynamically imported module",
        ]);
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
        await expectErrors(controller, [
          "ENOENT: no such file or directory, open '/src/App.vue'",
          "Failed to reload /src/App.vue",
          "Failed to reload /src/App.vue",
        ]);
      }
    );
  }
);

import { expectErrors, testSuite } from "@previewjs/e2e-test-runner";
import sveltePlugin from "@previewjs/plugin-svelte";

export const errorHandlingTests = testSuite(
  [sveltePlugin],
  "svelte/error handling",
  (test) => {
    test(
      "handles syntax errors gracefully when props untouched",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await previewIframe.waitForSelector("img");
        await appDir.update("src/App.svelte", {
          kind: "edit",
          search: /<img .*\/>/g,
          replace: "<img",
        });
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          [`Expected >`]
        );
        // The component should still be shown.
        await previewIframe.waitForSelector(".logo");
      }
    );

    test(
      "handles syntax errors gracefully when props updated",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await controller.props.editor.isReady();
        await controller.props.editor.replaceText(`
      properties = { foo: "bar" };
      `);
        await previewIframe.waitForSelector(".logo");
        await appDir.update("src/App.svelte", {
          kind: "edit",
          search: /<img .*\/>/g,
          replace: "<img",
        });
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          [`Expected >`]
        );
        // The component should still be shown.
        await previewIframe.waitForSelector(".logo");
      }
    );

    test(
      "recovers correctly after encountering broken imports",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await previewIframe.waitForSelector(".counter");
        await appDir.update(
          "src/App.svelte",
          {
            kind: "edit",
            search: "lib/Counter.svelte",
            replace: "lib/Broken.svelte",
          },
          {
            inMemoryOnly: true,
          }
        );
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          [
            "Failed to reload /src/App.svelte. This could be due to syntax errors or importing non-existent modules.",
          ]
        );
        await previewIframe.waitForSelector(".logo");
        await previewIframe.waitForSelector(".counter");
        await appDir.update(
          "src/App.svelte",
          {
            kind: "edit",
            search: "lib/Broken.svelte",
            replace: "lib/Counter.svelte",
          },
          {
            inMemoryOnly: true,
          }
        );
        await controller.waitForExpectedIframeRefresh();
        await appDir.update(
          "src/lib/Counter.svelte",
          {
            kind: "edit",
            search: `class="counter"`,
            replace: `class="counter-updated"`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          []
        );
        await previewIframe.waitForSelector(".logo");
        await previewIframe.waitForSelector(".counter-updated");
      }
    );

    test(
      "fails correctly when encountering broken CSS",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await appDir.update("src/App.svelte", {
          kind: "edit",
          search: ".logo {",
          replace: " BROKEN",
        });
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          ["Identifier is expected"]
        );
        await appDir.update("src/App.svelte", {
          kind: "edit",
          search: " BROKEN",
          replace: ".logo {",
        });
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          []
        );
      }
    );

    test(
      "shows error when file is missing before update",
      "svelte",
      async ({ controller }) => {
        await controller.show("src/AppMissing.svelte:AppMissing", {
          expectMissing: true,
        });
        await expectErrors(
          controller,
          {
            fullscreen: true,
          },
          [
            `Failed to resolve import "/src/AppMissing.svelte"`,
            "Failed to fetch dynamically imported module",
          ]
        );
      }
    );

    test(
      "shows error when file is missing after update",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await appDir.rename("src/App.svelte", "src/App-renamed.svelte");
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          [
            "Failed to reload /src/App.svelte",
            "Failed to reload /src/App.svelte",
          ]
        );
      }
    );
  }
);

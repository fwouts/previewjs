import { expect, testSuite, waitFor } from "@previewjs/e2e-test-runner";
import sveltePlugin from "@previewjs/plugin-svelte";

export const refreshingTests = testSuite(
  [sveltePlugin],
  "svelte/refreshing",
  (test) => {
    test("renders top-level component", "svelte", async ({ controller }) => {
      await controller.show("src/App.svelte:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".logo");
    });

    test(
      "renders top-level component after file system change",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await appDir.update("src/App.svelte", {
          kind: "edit",
          search: `class="logo"`,
          replace: `class="logo-modified"`,
        });
        await previewIframe.waitForSelector(".logo-modified");
      }
    );

    test(
      "renders top-level component after in-memory change",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await appDir.update(
          "src/App.svelte",
          {
            kind: "edit",
            search: `class="logo"`,
            replace: `class="logo-modified"`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await previewIframe.waitForSelector(".logo-modified");
      }
    );

    test(
      "renders updated dependency after file system change",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".counter");
        await appDir.update("src/lib/Counter.svelte", {
          kind: "edit",
          search: `class="counter"`,
          replace: `class="counter-modified"`,
        });
        await previewIframe.waitForSelector(".counter-modified");
      }
    );

    test(
      "renders updated dependency after in-memory change",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".counter");
        await appDir.update(
          "src/lib/Counter.svelte",
          {
            kind: "edit",
            search: `class="counter"`,
            replace: `class="counter-modified"`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await previewIframe.waitForSelector(".counter-modified");
      }
    );

    test(
      "renders updated CSS after file system change",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        expect(await getReadTheDocsWitdh()).toEqual(400);
        await appDir.update("src/App.svelte", {
          kind: "edit",
          search: `width: 400px`,
          replace: `width: 200px`,
        });
        await waitFor(async () => (await getReadTheDocsWitdh()) === 200);

        async function getReadTheDocsWitdh() {
          return (
            await (
              await previewIframe.waitForSelector(".read-the-docs")
            )?.boundingBox()
          )?.width;
        }
      }
    );

    test(
      "renders updated CSS after in-memory change",
      "svelte",
      async ({ appDir, controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        expect(await getReadTheDocsWidth()).toEqual(400);
        await appDir.update(
          "src/App.svelte",
          {
            kind: "edit",
            search: `width: 400px`,
            replace: `width: 200px`,
          },
          {
            inMemoryOnly: true,
          }
        );
        await waitFor(async () => (await getReadTheDocsWidth()) === 200);

        async function getReadTheDocsWidth() {
          return (
            await (
              await previewIframe.waitForSelector(".read-the-docs")
            )?.boundingBox()
          )?.width;
        }
      }
    );

    test(
      "switches to another component back and forth smoothly",
      "svelte",
      async ({ controller }) => {
        await controller.show("src/App.svelte:App");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(".logo");
        await controller.show("src/Other.svelte:Other");
        await previewIframe.waitForSelector(".other");
        await controller.show("src/App.svelte:App");
        await previewIframe.waitForSelector(".logo");
      }
    );
  }
);

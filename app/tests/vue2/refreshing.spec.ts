import { expect, testSuite, waitFor } from "../../testing";

export const refreshingTests = testSuite("vue2/refreshing", (test) => {
  test("renders top-level component", "vue2", async ({ controller }) => {
    await controller.show("src/App.vue:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#app");
  });

  test(
    "renders top-level component after file system change",
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#app");
      await appDir.update("src/App.vue", {
        kind: "edit",
        search: `id="app"`,
        replace: `id="app-modified"`,
      });
      await previewIframe.waitForSelector("#app-modified");
    }
  );

  test(
    "renders top-level component after in-memory change",
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#app");
      await appDir.update(
        "src/App.vue",
        {
          kind: "edit",
          search: `id="app"`,
          replace: `id="app-modified"`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await previewIframe.waitForSelector("#app-modified");
    }
  );

  test(
    "renders updated dependency after file system change",
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".hello");
      await appDir.update("src/components/HelloWorld.vue", {
        kind: "edit",
        search: `class="hello"`,
        replace: `class="hello-modified"`,
      });
      await previewIframe.waitForSelector(".hello-modified");
    }
  );

  test(
    "renders updated dependency after in-memory change",
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".hello");
      await appDir.update(
        "src/components/HelloWorld.vue",
        {
          kind: "edit",
          search: `class="hello"`,
          replace: `class="hello-modified"`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await previewIframe.waitForSelector(".hello-modified");
    }
  );

  test(
    "renders updated CSS after file system change",
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      expect(await getHelloWorldWidth()).toEqual(400);
      await appDir.update("src/components/HelloWorld.vue", {
        kind: "edit",
        search: `width: 400px`,
        replace: `width: 200px`,
      });
      await waitFor(async () => (await getHelloWorldWidth()) === 200);

      async function getHelloWorldWidth() {
        return (
          await (await previewIframe.waitForSelector(".hello"))?.boundingBox()
        )?.width;
      }
    }
  );

  test(
    "renders updated CSS after in-memory change",
    "vue2",
    async ({ appDir, controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      expect(await getHelloWorldWidth()).toEqual(400);
      await appDir.update(
        "src/components/HelloWorld.vue",
        {
          kind: "edit",
          search: `width: 400px`,
          replace: `width: 200px`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await waitFor(async () => (await getHelloWorldWidth()) === 200);

      async function getHelloWorldWidth() {
        return (
          await (await previewIframe.waitForSelector(".hello"))?.boundingBox()
        )?.width;
      }
    }
  );

  test(
    "switches to another component back and forth smoothly",
    "vue2",
    async ({ controller }) => {
      await controller.show("src/App.vue:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector("#app");
      await controller.show("src/Other.vue:Other");
      await previewIframe.waitForSelector(".other");
      await controller.show("src/App.vue:App");
      await previewIframe.waitForSelector("#app");
    }
  );
});

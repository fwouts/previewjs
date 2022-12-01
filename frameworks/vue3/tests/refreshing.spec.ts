import test, { expect } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const testApp = path.join(__dirname, "apps", "vue3");

test.describe.parallel("vue3/refreshing", () => {
  const test = previewTest([pluginFactory], testApp);

  test("renders top-level component", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".logo");
  });

  test("switches to another component back and forth smoothly between different files", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.show("src/Other.vue:Other");
    await preview.iframe.waitForSelector(".other");
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector(".logo");
  });

  for (const inMemoryOnly of [false, true]) {
    test(`updates top-level component after file change (inMemoryOnly=${inMemoryOnly})`, async (preview) => {
      await preview.show("src/App.vue:App");
      await preview.iframe.waitForSelector(".logo");
      await preview.fileManager.update(
        "src/App.vue",
        {
          replace: `class="logo"`,
          with: `class="logo-modified"`,
        },
        {
          inMemoryOnly,
        }
      );
      await preview.iframe.waitForSelector(".logo-modified");
    });

    test(`updates dependency after file change (inMemoryOnly=${inMemoryOnly})`, async (preview) => {
      await preview.show("src/App.vue:App");
      await preview.iframe.waitForSelector(".hello");
      await preview.fileManager.update(
        "src/components/HelloWorld.vue",
        {
          replace: `class="hello"`,
          with: `class="hello-modified"`,
        },
        {
          inMemoryOnly,
        }
      );
      await preview.iframe.waitForSelector(".hello-modified");
    });

    test(`updates CSS after file change (inMemoryOnly=${inMemoryOnly})`, async (preview) => {
      await preview.show("src/App.vue:App");
      const helloWorld = await preview.iframe.waitForSelector(".hello");
      expect((await helloWorld?.boundingBox())?.width).toEqual(400);
      await preview.fileManager.update(
        "src/components/HelloWorld.vue",
        {
          replace: `width: 400px`,
          with: `width: 200px`,
        },
        {
          inMemoryOnly,
        }
      );
      expect((await helloWorld?.boundingBox())?.width).toEqual(200);
    });
  }
});

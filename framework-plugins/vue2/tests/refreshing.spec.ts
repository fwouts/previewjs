import test, { expect } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "vue2");

test.describe.parallel("vue2/refreshing", () => {
  const test = previewTest([pluginFactory], testApp);

  test("renders top-level component", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector("#app");
  });

  test("switches to another component back and forth smoothly between different files", async (preview) => {
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector("#app");
    await preview.show("src/Other.vue:Other");
    await preview.iframe.waitForSelector(".other");
    await preview.show("src/App.vue:App");
    await preview.iframe.waitForSelector("#app");
  });

  for (const inMemoryOnly of [false, true]) {
    test(`updates top-level component after file change (inMemoryOnly=${inMemoryOnly})`, async (preview) => {
      await preview.show("src/App.vue:App");
      await preview.iframe.waitForSelector("#app");
      await preview.fileManager.update(
        "src/App.vue",
        {
          replace: `id="app"`,
          with: `id="app-modified"`,
        },
        {
          inMemoryOnly,
        }
      );
      await preview.iframe.waitForSelector("#app-modified");
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

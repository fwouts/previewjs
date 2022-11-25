import test, { expect } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const testApp = path.join(__dirname, "apps", "svelte");

test.describe("svelte/refreshing", () => {
  const test = previewTest([pluginFactory], testApp);

  test("renders top-level component", async (preview) => {
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
  });

  test("switches to another component back and forth smoothly between different files", async (preview) => {
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
    await preview.show("src/Other.svelte:Other");
    await preview.iframe.waitForSelector(".other");
    await preview.show("src/App.svelte:App");
    await preview.iframe.waitForSelector(".logo");
  });

  for (const inMemoryOnly of [false, true]) {
    test.describe(
      inMemoryOnly ? "in-memory file change" : "real file change",
      () => {
        test("updates top-level component after file change", async (preview) => {
          await preview.show("src/App.svelte:App");
          await preview.iframe.waitForSelector(".logo");
          await preview.fileManager.update(
            "src/App.svelte",
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

        test("updates dependency after file change", async (preview) => {
          await preview.show("src/App.svelte:App");
          await preview.iframe.waitForSelector(".counter");
          await preview.fileManager.update(
            "src/lib/Counter.svelte",
            {
              replace: `class="counter"`,
              with: `class="counter-modified"`,
            },
            {
              inMemoryOnly,
            }
          );
          await preview.iframe.waitForSelector(".counter-modified");
        });

        test("updates CSS after file change", async (preview) => {
          await preview.show("src/App.svelte:App");
          const readTheDocs = await preview.iframe.waitForSelector(
            ".read-the-docs"
          );
          expect((await readTheDocs?.boundingBox())?.width).toEqual(400);
          await preview.fileManager.update(
            "src/App.svelte",
            {
              replace: `width: 400px`,
              with: `width: 200px`,
            },
            {
              inMemoryOnly,
            }
          );
          expect((await readTheDocs?.boundingBox())?.width).toEqual(200);
        });
      }
    );
  }
});

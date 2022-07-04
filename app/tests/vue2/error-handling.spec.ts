import { expectErrors } from "@previewjs/e2e-test-runner";
import vue2Plugin from "@previewjs/plugin-vue2";
import { describe, it } from "vitest";

describe("vue2/error handling", () => {
  it("handles syntax errors gracefully when props untouched", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
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
  });

  it("handles syntax errors gracefully when props updated", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
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
  });

  it("recovers correctly after encountering broken imports", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
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
  });

  it("fails correctly when encountering broken CSS", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
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
  });

  it("shows error when file is missing before update", async (ctx) => {
    const { controller } = await ctx.setupTest("vue2", [vue2Plugin]);
    await controller.show("src/AppMissing.vue:AppMissing");
    await expectErrors(controller, [
      `Failed to resolve import "/src/AppMissing.vue"`,
      "Failed to fetch dynamically imported module",
    ]);
  });

  it("shows error when file is missing after update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
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
  });
});

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

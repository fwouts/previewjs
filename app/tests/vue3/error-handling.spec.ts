import { expectErrors } from "@previewjs/e2e-test-runner";
import vue3Plugin from "@previewjs/plugin-vue3";
import path from "path";
import { describe, it } from "vitest";

describe("vue3/error handling", () => {
  it("handles syntax errors gracefully when props untouched", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  });

  it("handles syntax errors gracefully when props updated", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  });

  it("recovers correctly after encountering broken imports", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  });

  it("fails correctly when encountering broken CSS", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  });

  it("shows error when file is missing before update", async (ctx) => {
    const { controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await controller.show("src/AppMissing.vue:AppMissing");
    await expectErrors(controller, [
      `Failed to resolve import "/src/AppMissing.vue"`,
      "Failed to fetch dynamically imported module",
    ]);
  });

  it("shows error when file is missing after update", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await controller.show("src/App.vue:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".logo");
    await appDir.rename("src/App.vue", "src/App-renamed.vue");
    await expectErrors(controller, [
      "ENOENT: no such file or directory, open '/src/App.vue'",
      "Failed to reload /src/App.vue",
      "Failed to reload /src/App.vue",
    ]);
  });
});

function sleep(seconds: number) {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

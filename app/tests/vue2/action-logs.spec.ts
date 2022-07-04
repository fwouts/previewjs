import vue2Plugin from "@previewjs/plugin-vue2";
import { describe, it } from "vitest";

describe("vue2/action logs", () => {
  it("shows action logs on link click", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
    await appDir.update("src/App.vue", {
      kind: "replace",
      text: `
<template>
  <a id="link" href="https://www.google.com">
    Hello, World!
  </a>
</template>
`,
    });
    await controller.show("src/App.vue:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#link");
    await previewIframe.click("#link");
    const actionLog = await controller.actionLog.get(
      "Redirect prevented: https://www.google.com"
    );
    await actionLog.waitUntilVisible();
    await actionLog.waitUntilGone();
  });
});

import vue2Plugin from "@previewjs/plugin-vue2";
import { describe, it } from "vitest";

function source(previews: string | null) {
  return `
<template>
  <button id="button" v-bind:disabled="disabled">
    {{ label }}
  </button>
</template>

<script>
export default {
  name: "Button",
  props: {
    label: {
      type: String,
      default: "no label provided"
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  ${previews ? `previews: ${previews}` : ""}
}
</script>
`.trim();
}

describe("vue2/custom preview", () => {
  it("shows variants when already configured", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(`{
          default: {
            label: "default variant",
          },
          disabled: {
            label: "disabled variant",
            disabled: true,
          },
        }`),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]"
    );

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(null),
    });
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]",
      {
        state: "hidden",
      }
    );
    await previewIframe.waitForSelector("#button");
  });

  it("shows variants once preview added and hides once removed", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(`{
          default: {
            label: "default variant",
          },
          disabled: {
            label: "disabled variant",
            disabled: true,
          },
        }`),
    });
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]"
    );

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(null),
    });
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]",
      {
        state: "hidden",
      }
    );
    await previewIframe.waitForSelector("#button");
  });

  it("supports variants defined as function", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(`() => ({
            default: {
              label: "custom label",
            },
          })`),
    });
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'custom label')]"
    );
  });

  it("updates when preview is updated", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(`{
          default: {
            label: "default variant",
          },
          disabled: {
            label: "disabled variant",
            disabled: true,
          },
        }`),
    });
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]"
    );

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(`{
          default: {
            label: "foo label",
          },
          disabled: {
            label: "bar label",
            disabled: true,
          },
        }`),
    });
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'foo label')]"
    );
  });

  it("hides props editor for configured variants", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue2", [vue2Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");
    await controller.props.editor.isReady();

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: source(`{
          default: {
            label: "default",
          },
        }`),
    });

    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'default')]"
    );
    await controller.props.editor.waitUntilGone();

    await controller.component.label().click();
    await controller.props.editor.isReady();

    await controller.props.editor.replaceText(`properties = {
        label: "foo"
      }`);
    await previewIframe.waitForSelector("xpath=//button[contains(., 'foo')]");
  });
});

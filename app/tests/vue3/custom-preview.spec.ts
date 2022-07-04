import vue3Plugin from "@previewjs/plugin-vue3";
import { describe, it } from "vitest";

function sourceClassic(previews: string | null) {
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

function sourceWithSetupScript(previews: string) {
  return `
<script setup lang="ts">
import { definePreviews } from '@previewjs/plugin-vue3/setup';

interface Props {
  label?: string,
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: "no label provided",
  disabled: false
})

definePreviews<Props>(${previews})
</script>
<template>
  <button id="button" v-bind:disabled="disabled">
    {{ label }}
  </button>
</template>
`.trim();
}

describe("vue3/custom preview", () => {
  it("shows variants when already configured with previews property", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(`{
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
      text: sourceClassic(null),
    });
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]",
      {
        state: "hidden",
      }
    );
    await previewIframe.waitForSelector("#button");
  });

  it("shows variants when already configured with setup script", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceWithSetupScript(`{
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
      text: sourceClassic(null),
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
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(`{
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
      text: sourceClassic(null),
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
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(`() => ({
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
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(`{
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
      text: sourceClassic(`{
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
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(null),
    });
    await controller.show("src/Button.vue:Button");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector("#button");
    await controller.props.editor.isReady();

    await appDir.update("src/Button.vue", {
      kind: "replace",
      text: sourceClassic(`{
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

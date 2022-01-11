import { testSuite } from "../../testing";

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

export const customPreviewTests = testSuite("vue2/custom preview", (test) => {
  test(
    "shows variants when already configured",
    "vue2",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "shows variants once preview added and hides once removed",
    "vue2",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "supports variants defined as function",
    "vue2",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "updates when preview is updated",
    "vue2",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "hides props editor for configured variants",
    "vue2",
    async ({ appDir, controller }) => {
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
    }
  );
});

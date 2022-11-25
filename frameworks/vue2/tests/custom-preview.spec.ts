import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

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

const testApp = path.join(__dirname, "apps", "vue2");

test.describe("vue2/custom preview", () => {
  const test = previewTest([pluginFactory], testApp);

  test("shows variants when already configured", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      source(`{
        default: {
          label: "default variant",
        },
        disabled: {
          label: "disabled variant",
          disabled: true,
        },
      }`)
    );
    await preview.show("src/Button.vue:Button", { variantKey: "default" });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]"
    );
  });

  test("supports variants defined as function", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      source(`() => ({
        default: {
          label: "custom label",
        },
      })`)
    );
    await preview.show("src/Button.vue:Button", { variantKey: "default" });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'custom label')]"
    );
  });

  test("updates when preview is updated", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      source(`{
        default: {
          label: "default variant",
        },
        disabled: {
          label: "disabled variant",
          disabled: true,
        },
      }`)
    );
    await preview.show("src/Button.vue:Button", { variantKey: "default" });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'default variant')]"
    );
    await preview.fileManager.update(
      "src/Button.vue",
      source(`{
        default: {
          label: "foo label",
        },
        disabled: {
          label: "disabled variant",
          disabled: true,
        },
      }`)
    );
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'foo label')]"
    );
  });
});

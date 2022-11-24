import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

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

const testApp = path.join(__dirname, "apps", "vue3");

test.describe("vue3/custom preview", () => {
  const test = previewTest([pluginFactory], testApp);

  test("shows variants when already configured with previews property", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      sourceClassic(`{
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

  test("shows variants when already configured with setup script", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      sourceWithSetupScript(`{	
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

  test("supports variants defined as function with previews property", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      sourceClassic(`() => ({
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

  test("supports variants defined as function with setup script", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      sourceWithSetupScript(`() => ({
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

  test("updates when preview is updated with previews property", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      sourceClassic(`{
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
      sourceClassic(`{
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

  test("updates when preview is updated with setup script", async (preview) => {
    await preview.fileManager.update(
      "src/Button.vue",
      sourceWithSetupScript(`{
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
      sourceWithSetupScript(`{
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

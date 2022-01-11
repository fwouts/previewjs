import { testSuite } from "../../testing";

const buttonVueSource = `
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
      required: true
    },
    disabled: {
      type: Boolean,
      default: false
    }
  }
}
</script>
`;

export const storybookTests = testSuite("vue3/storybook", (test) => {
  test(
    "renders basic Storybook component",
    "vue3",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.vue", {
        kind: "replace",
        text: buttonVueSource,
      });
      await appDir.update("src/Button.stories.js", {
        kind: "replace",
        text: `
import Button from './Button.vue';

export const Primary = () => ({
  components: { Button },
  template: '<Button label="Button" />'
})
      `,
      });
      await controller.show("src/Button.stories.js:Primary");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'Button')]"
      );
    }
  );

  test(
    "renders templated Storybook component",
    "vue3",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.vue", {
        kind: "replace",
        text: buttonVueSource,
      });
      await appDir.update("src/Button.stories.js", {
        kind: "replace",
        text: `
import Button from './Button.vue';

const Template = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});

export const Primary = Template.bind({});
Primary.args = {
  label: 'Button',
};
      `,
      });
      await controller.show("src/Button.stories.js:Primary");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(
        "xpath=//button[contains(., 'Button')]"
      );
    }
  );
});

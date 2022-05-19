import { testSuite } from "../../testing";
import { expectErrors } from "../../testing/helpers/expect-errors";

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

export const storybookTests = testSuite("vue2/storybook", (test) => {
  test(
    "renders basic Storybook component",
    "vue2",
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
    "vue2",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.vue", {
        kind: "replace",
        text: buttonVueSource,
      });
      await appDir.update("src/Button.stories.js", {
        kind: "replace",
        text: `
import Button from './Button.vue';

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { Button },
  template: '<Button v-bind="$props" />',
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

  test(
    "renders Storybook component with implicit template",
    "vue2",
    async ({ appDir, controller }) => {
      await appDir.update("src/Button.vue", {
        kind: "replace",
        text: buttonVueSource,
      });
      await appDir.update("src/Button.stories.js", {
        kind: "replace",
        text: `
import Button from './Button.vue';

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { Button },
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

  test(
    "shows error when Storybook component no longer available",
    "vue2",
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
      await appDir.update("src/Button.stories.js", {
        kind: "edit",
        search: "Primary",
        replace: "Renamed",
      });
      await expectErrors(controller, [`Error: No component named 'Primary'`]);
    }
  );
});

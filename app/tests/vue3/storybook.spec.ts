import { expectErrors } from "@previewjs/e2e-test-runner";
import vue3Plugin from "@previewjs/plugin-vue3";
import { describe, it } from "vitest";

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

describe("vue3/storybook", () => {
  it("renders basic Storybook component", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  });

  it("renders templated Storybook component", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  label: 'Hello, World!',
};
      `,
    });
    await controller.show("src/Button.stories.js:Primary");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  it("renders Storybook component with default args", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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

export default {
  args: {
    label: "Hello, World!"
  }
};
      `,
    });
    await controller.show("src/Button.stories.js:Primary");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  it("renders Storybook component with default args", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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

export default {
  args: {
    label: "Hello, World!"
  }
};
      `,
    });
    await controller.show("src/Button.stories.js:Primary");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  it("renders Storybook component with explicit args over default args", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  label: "explicit"
}

export default {
  args: {
    label: "default"
  }
};
      `,
    });
    await controller.show("src/Button.stories.js:Primary");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(
      "xpath=//button[contains(., 'explicit')]"
    );
  });

  it("shows error when Storybook component no longer available", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("vue3", [vue3Plugin]);
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
  });
});

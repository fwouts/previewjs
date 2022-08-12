import { expectErrors, testSuite } from "@previewjs/e2e-test-runner";
import vue2Plugin from "@previewjs/plugin-vue2";

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

export const storybookTests = testSuite(
  [vue2Plugin],
  "vue2/storybook",
  (test) => {
    test("renders basic CSF2 story", "vue2", async ({ appDir, controller }) => {
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

    test(
      "renders templated CSF2 story with different props",
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
  template: '<Button :label="different" />',
});

export const Primary = Template.bind({});
Primary.args = {
  different: "Hello, World!",
};
      `,
        });
        await controller.show("src/Button.stories.js:Primary");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      }
    );

    test(
      "renders templated CSF2 story",
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
  label: "Hello, World!",
};
      `,
        });
        await controller.show("src/Button.stories.js:Primary");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      }
    );

    test(
      "renders CSF2 story with implicit template",
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
  label: "Hello, World!",
};
      `,
        });
        await controller.show("src/Button.stories.js:Primary");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      }
    );

    test(
      "renders CSF2 story with default args",
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
      }
    );

    test(
      "renders CSF2 story with explicit args over default args",
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
  label: "explicit"
};

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
      }
    );

    test(
      "renders CSF3 story with explicit args",
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

export default {
  component: Button
};

export const Primary = {
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
      }
    );

    test(
      "renders CSF3 story with default args",
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

export default {
  component: Button,
  args: {
    label: "Hello, World!"
  }
};

export const Primary = {};
      `,
        });
        await controller.show("src/Button.stories.js:Primary");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      }
    );

    test(
      "renders CSF3 story with explicit args over default args",
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

export default {
  component: Button,
  args: {
    label: "default"
  }
};

export const Primary = {
  args: {
    label: "explicit"
  }
};
      `,
        });
        await controller.show("src/Button.stories.js:Primary");
        const previewIframe = await controller.previewIframe();
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'explicit')]"
        );
      }
    );

    test(
      "shows error when CSF2 story no longer available",
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
  }
);

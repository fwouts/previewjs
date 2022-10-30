import { expectErrors, testSuite } from "@previewjs/e2e-test-runner";
import sveltePlugin from "@previewjs/plugin-svelte";

const buttonSvelteSource = `
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
  [sveltePlugin],
  "svelte/storybook",
  (test) => {
    test(
      "renders basic CSF2 story",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

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
      "renders templated CSF2 story",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

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
      }
    );

    test(
      "renders templated CSF2 story with different props",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

const Template = ({ different }) => ({
  components: { Button },
  setup() {
    return { different };
  },
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
      "renders CSF2 story with default args",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

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
      }
    );

    test(
      "renders CSF2 story with explicit args over default args",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

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
      }
    );

    test(
      "renders CSF3 story with explicit args",
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

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
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

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
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: `
import Button from './Button.svelte';

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
      "svelte",
      async ({ appDir, controller }) => {
        await appDir.update("src/Button.svelte", {
          kind: "replace",
          text: buttonSvelteSource,
        });
        await appDir.update("src/Button.stories.js", {
          kind: "replace",
          text: ` 
import Button from './Button.svelte';

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
        await expectErrors(
          controller,
          {
            fullscreen: false,
          },
          [`Error: No component named 'Primary'`]
        );
      }
    );
  }
);

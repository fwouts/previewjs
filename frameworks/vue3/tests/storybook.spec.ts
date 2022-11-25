import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

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

const testApp = path.join(__dirname, "apps", "vue3");

test.describe("vue3/storybook", () => {
  const test = previewTest([pluginFactory], testApp);

  test("renders basic CSF2 story", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export const Primary = () => ({
        components: { Button },
        template: '<Button label="Button" />'
      })`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Button')]"
    );
  });

  test("renders templated CSF2 story with different props", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

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
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  test("renders templated CSF2 story", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      const Template = (args) => ({
        components: { Button },
        setup() {
          return { args };
        },
        template: '<Button v-bind="args" />',
      });

      export const Primary = Template.bind({});
      Primary.args = {
        label: "Hello, World!",
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  test("renders CSF2 story with default args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      const Template = (args) => ({
        components: { Button },
        setup() {
          return { args };
        },
        template: '<Button v-bind="args" />',
      });

      export const Primary = Template.bind({});
      Primary.args = {};

      export default {
        args: {
          label: "Hello, World!"
        }
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  test("renders CSF2 story with explicit args over default args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

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
      };

      export default {
        args: {
          label: "default"
        }
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'explicit')]"
    );
  });

  test("renders CSF3 story with explicit args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export default {
        component: Button
      };

      export const Primary = {
        args: {
          label: "Hello, World!"
        }
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  test("renders CSF3 story with default args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export default {
        component: Button,
        args: {
          label: "Hello, World!"
        }
      };

      export const Primary = {};`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
  });

  test("renders CSF3 story with explicit args over default args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

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
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'explicit')]"
    );
  });

  test("detects when CSF2 story no longer available", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export const Primary = () => ({
        components: { Button },
        template: '<Button label="Button" />'
      });`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Button')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "Primary",
      with: "Renamed",
    });
    await await preview.expectLoggedMessages.toMatch([
      "Error: No component named 'Primary'",
    ]);
  });
});

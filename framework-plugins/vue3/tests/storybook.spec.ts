import { test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

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

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "vue3");

test.describe.parallel("vue3/storybook", () => {
  const test = previewTest(pluginFactory, testApp);

  test("renders basic CSF2 story", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export default {
        component: Button
      }

      export const Primary = () => ({
        components: { Button },
        template: '<Button label="Hello, World!" />'
      })`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hello, World!')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "Hello, World!",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders templated CSF2 story with different props", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';
      
      export default {
        component: Button
      }

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
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "Hello, World!",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders templated CSF2 story", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';
      
      export default {
        component: Button
      }

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
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "Hello, World!",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders templated CSF2 story with assignment source referring local variable", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export default {
        component: Button
      }

      const baseArgs = {
        label: "local value"
      };

      const Template = (args) => ({
        components: { Button },
        setup() {
          return { args };
        },
        template: '<Button v-bind="args" />',
      });

      export const Primary = Template.bind({});
      Primary.args = {
        label: "label",
      };`
    );
    await preview.show(
      "src/Button.stories.js:Primary",
      `properties = {
        ...baseArgs
      }`
    );
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'local value')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "local value",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders CSF2 story with default export args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';
      
      export default {
        component: Button,
        args: {
          label: "default export"
        }
      }

      const Template = (args) => ({
        components: { Button },
        setup() {
          return { args };
        },
        template: '<Button v-bind="args" />',
      });

      export const Primary = Template.bind({});
      Primary.args = {};`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'default export')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "default export",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders CSF2 story with explicit args over default export args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';
      
      export default {
        component: Button,
        args: {
          label: "default export"
        }
      }

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
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'explicit')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "explicit",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
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
          label: "explicit"
        }
      };`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'explicit')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "explicit",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders CSF3 story with assignment source referring local variable", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export default {
        component: Button
      };

      const baseArgs = {
        label: "local value"
      };

      export const Primary = {
        args: {
          label: "label"
        }
      };`
    );
    await preview.show(
      "src/Button.stories.js:Primary",
      `properties = {
        ...baseArgs
      }`
    );
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'local value')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "local value",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders CSF3 story with default export args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export default {
        component: Button,
        args: {
          label: "default export"
        }
      };

      export const Primary = {};`
    );
    await preview.show("src/Button.stories.js:Primary");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'default export')]"
    );
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "default export",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("renders CSF3 story with explicit args over default export args", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';

      export default {
        component: Button,
        args: {
          label: "default export"
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
    await preview.fileManager.update("src/Button.stories.js", {
      replace: "explicit",
      with: "Hi, World!",
    });
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Hi, World!')]"
    );
  });

  test("detects when CSF2 story no longer available", async (preview) => {
    await preview.fileManager.update("src/Button.vue", buttonVueSource);
    await preview.fileManager.update(
      "src/Button.stories.js",
      `import Button from './Button.vue';
      
      export default {
        component: Button
      }

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
    await preview.expectErrors.toMatch([
      "No component or story named 'Primary'",
    ]);
  });
});

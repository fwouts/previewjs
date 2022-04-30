import { expect, testSuite } from "@previewjs/app/testing";
import { elements } from "./elements";

export const multipleComponentsTests = testSuite(
  "multiple components",
  (test) => {
    for (const version of [16, 17, 18]) {
      test(
        `${version}/shows multiple components (React)`,
        `react${version}`,
        async ({ appDir, controller }) => {
          const { component } = elements(controller);
          await appDir.update("src/Components.tsx", {
            kind: "replace",
            text: `
import React from "react";

export function A({ label = "Hello from A" }: {label?: string}) {
  return <button>{label}</button>;
}

export function B() {
  return <button>Hello from B</button>;
}

function C() {
  return <button>Hello from C</button>;
}
`,
          });
          await appDir.update("src/Components.stories.js", {
            kind: "replace",
            text: `
import React from "react";
import { A } from "./Components";

const Template = (args) => <A {...args} />;

export const ShortLabel = Template.bind({});
ShortLabel.args = {
  label: 'short',
};

export const LongLabel = Template.bind({});
LongLabel.args = {
  label: 'this is a long label',
};
`,
          });
          await controller.show("src/Components.tsx");

          await controller.noSelection.waitUntilVisible();

          await component.get("A").click();
          await controller.noSelection.waitUntilGone();
          expect(await controller.component.label().text()).toEqual("A");

          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello from A')]"
          );

          await component.get("B").click();
          expect(await controller.component.label().text()).toEqual("B");
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello from B')]"
          );

          await component.get("C").click();
          expect(await controller.component.label().text()).toEqual("C");
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello from C')]"
          );

          await component.get("ShortLabel").click();
          expect(await controller.component.label().text()).toEqual(
            "ShortLabel"
          );
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'short')]"
          );

          await component.get("LongLabel").click();
          expect(await controller.component.label().text()).toEqual(
            "LongLabel"
          );
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'this is a long label')]"
          );
        }
      );

      test(
        `${version}/shows multiple components (Vue 2)`,
        "vue2",
        async ({ appDir, controller }) => {
          const { component } = elements(controller);
          await appDir.update("src/Button.vue", {
            kind: "replace",
            text: `
<template>
  <button>{{ label }}</button>
</template>
<script>
export default {
  name: "Button",
  props: {
    label: {
      type: String,
      required: true
    }
  }
}
</script>
`,
          });
          await appDir.update("src/Button.stories.js", {
            kind: "replace",
            text: `
import Button from './Button.vue';

export default {
  component: Button,
};

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { Button },
});

export const ShortLabel = Template.bind({});
ShortLabel.args = {
  label: 'short',
};

export const LongLabel = Template.bind({});
LongLabel.args = {
  label: 'this is a long label',
};
`,
          });
          await controller.show("src/Button.vue");

          await controller.noSelection.waitUntilVisible();

          await component.get("Button").click();
          await controller.noSelection.waitUntilGone();
          expect(await controller.component.label().text()).toEqual("Button");

          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'label')]"
          );

          await component.get("ShortLabel").click();
          expect(await controller.component.label().text()).toEqual(
            "ShortLabel"
          );
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'short')]"
          );

          await component.get("LongLabel").click();
          expect(await controller.component.label().text()).toEqual(
            "LongLabel"
          );
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'this is a long label')]"
          );
        }
      );

      test(
        `${version}/shows multiple components (Vue 3)`,
        "vue3",
        async ({ appDir, controller }) => {
          const { component } = elements(controller);
          await appDir.update("src/Button.vue", {
            kind: "replace",
            text: `
<script setup lang="ts">
defineProps<{ label: string }>();
</script>

<template>
  <button>{{ label }}</button>
</template>
`,
          });
          await appDir.update("src/Button.stories.js", {
            kind: "replace",
            text: `
import Button from './Button.vue';

export default {
  component: Button,
};

const Template = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});

export const ShortLabel = Template.bind({});
ShortLabel.args = {
  label: 'short',
};

export const LongLabel = Template.bind({});
LongLabel.args = {
  label: 'this is a long label',
};
`,
          });
          await controller.show("src/Button.vue");

          await controller.noSelection.waitUntilVisible();

          await component.get("Button").click();
          await controller.noSelection.waitUntilGone();
          expect(await controller.component.label().text()).toEqual("Button");

          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'label')]"
          );

          await component.get("ShortLabel").click();
          expect(await controller.component.label().text()).toEqual(
            "ShortLabel"
          );
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'short')]"
          );

          await component.get("LongLabel").click();
          expect(await controller.component.label().text()).toEqual(
            "LongLabel"
          );
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'this is a long label')]"
          );
        }
      );
    }
  }
);

import { expect, testSuite } from "@previewjs/app/testing";
import { elements } from "./elements";

const mainSource = `
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
`;

const storySource = `
import React from "react";
import { A } from './Components';

const Template = (args) => <A {...args} />;

export const ShortLabel = Template.bind({});
ShortLabel.args = {
  label: 'short',
};

export const LongLabel = Template.bind({});
LongLabel.args = {
  label: 'this is a long label',
};
`;

export const multipleComponentsTests = testSuite(
  "multiple components",
  (test) => {
    test(
      "shows multiple components",
      "react",
      async ({ appDir, controller }) => {
        const { component } = elements(controller);
        await appDir.update("src/Components.tsx", {
          kind: "replace",
          text: mainSource,
        });
        await appDir.update("src/Components.stories.js", {
          kind: "replace",
          text: storySource,
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
        expect(await controller.component.label().text()).toEqual("ShortLabel");
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'short')]"
        );

        await component.get("LongLabel").click();
        expect(await controller.component.label().text()).toEqual("LongLabel");
        await previewIframe.waitForSelector(
          "xpath=//button[contains(., 'this is a long label')]"
        );
      }
    );
  }
);

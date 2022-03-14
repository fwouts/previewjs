import { expect, testSuite } from "@previewjs/app/testing";
import { elements } from "./elements";

const source = `
import React from "react";

export function A() {
  return <button>Hello from A</button>;
}

export function B() {
  return <button>Hello from B</button>;
}

function C() {
  return <button>Hello from C</button>;
}
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
          text: source,
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
      }
    );
  }
);

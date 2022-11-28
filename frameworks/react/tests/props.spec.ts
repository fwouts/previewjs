import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

const testApp = (suffix: string | number) =>
  path.join(__dirname, "apps", "react" + suffix);

for (const reactVersion of [16, 17, 18]) {
  test.describe.parallel(`v${reactVersion}`, () => {
    test.describe.parallel("react/props", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("controls props", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `import React from "react";

          export function Button(props: { label: string; disabled?: boolean }) {
          return (
            <button id="button" disabled={props.disabled}>
              {props.label}
            </button>
          );
          }`
        );
        await preview.show("src/Button.tsx:Button");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'label')]"
        );

        await preview.show(
          "src/Button.tsx:Button",
          `properties = { label: "Hello, World!" }`
        );
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      });
    });
  });
}

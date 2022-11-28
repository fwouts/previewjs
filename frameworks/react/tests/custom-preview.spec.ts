import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";
import { reactVersions } from "./react-versions";

const originalSource = `
import React from "react";
export function Button(props: { label: string; disabled?: boolean }) {
  return (
    <button id="button" disabled={props.disabled}>
      {props.label}
    </button>
  );
}
`;

const testApp = (suffix: string | number) =>
  path.join(__dirname, "apps", "react" + suffix);

for (const reactVersion of reactVersions()) {
  test.describe.parallel(`v${reactVersion}`, () => {
    test.describe.parallel("react/custom preview", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("shows variants when already configured", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `import { setupPreviews } from '@previewjs/plugin-react/setup';
          ${originalSource}
          setupPreviews(Button, {
            default: {
              label: "default variant",
            },
            disabled: {
              label: "disabled variant",
              disabled: true,
            },
          });`
        );
        await preview.show("src/Button.tsx:Button", { variantKey: "default" });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'default variant')]"
        );
      });

      test("supports variants defined as function", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `import { setupPreviews } from '@previewjs/plugin-react/setup';
          ${originalSource}
          setupPreviews(Button, () => ({
            default: {
              label: "custom label",
            },
          }));`
        );
        await preview.show("src/Button.tsx:Button", { variantKey: "default" });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'custom label')]"
        );
      });

      test("updates when preview is updated", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `import { setupPreviews } from '@previewjs/plugin-react/setup';
          ${originalSource}
          setupPreviews(Button, {
            default: {
              label: "default",
            },
            disabled: {
              label: "disabled",
              disabled: true,
            },
          });`
        );
        await preview.show("src/Button.tsx:Button", { variantKey: "default" });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'default')]"
        );
        await preview.fileManager.update(
          "src/Button.tsx",
          `import { setupPreviews } from '@previewjs/plugin-react/setup';
          ${originalSource}
          setupPreviews(Button, {
            default: {
              label: "foo label",
            },
            disabled: {
              label: "disabled",
              disabled: true,
            },
          });`
        );
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'foo label')]"
        );
      });
    });
  });
}

import test, { expect } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = (suffix: string | number) =>
  path.join(__dirname, "../../../test-apps/react" + suffix);

for (const reactVersion of [16, 17, 18]) {
  test.describe(`v${reactVersion}`, () => {
    test.describe("react/action logs", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("emits action event for auto-generated callbacks", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `function Button(props: { label: string; onClick(): void }) {
            return (
              <button id="button" onClick={props.onClick}>
                {props.label}
              </button>
            );
          }`
        );
        await preview.show("src/Button.tsx:Button");
        const button = await preview.iframe.waitForSelector("#button");
        preview.events.clear();
        await button.click();
        expect(preview.events.get()).toEqual([
          {
            kind: "action",
            path: "onClick",
            type: "fn",
          },
        ]);
      });

      test("emits action event for explicit callbacks", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `function Button(props: { label: string; onClick(): void }) {
            return (
              <button id="button" onClick={props.onClick}>
                {props.label}
              </button>
            );
          }`
        );
        await preview.show(
          "src/Button.tsx:Button",
          `properties = {
            onClick: () => {
              console.log("onClick callback invoked!");
            }
          }`
        );
        const button = await preview.iframe.waitForSelector("#button");
        preview.events.clear();
        await button.click();
        expect(preview.events.get()).toEqual([
          {
            kind: "action",
            path: "onClick",
            type: "fn",
          },
          {
            kind: "log-message",
            level: "log",
            timestamp: expect.anything(),
            message: "onClick callback invoked!",
          },
        ]);
      });

      test("shows action logs on link click", async (preview) => {
        await preview.fileManager.update(
          "src/Link.tsx",
          `function Link() {
            return (
              <a id="link" href="https://www.google.com">
                Hello, World!
              </a>
            );
          }`
        );
        await preview.show("src/Link.tsx:Link");
        const link = await preview.iframe.waitForSelector("#link");
        preview.events.clear();
        await link.click();
        expect(preview.events.get()).toEqual([
          {
            kind: "action",
            path: "https://www.google.com/",
            type: "url",
          },
        ]);
      });
    });
  });
}

import { expect, test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "solid");

test.describe.parallel("solid/action logs", () => {
  const test = previewTest(pluginFactory, testApp);

  test("emits action event for auto-generated callbacks", async (preview) => {
    await preview.fileManager.update(
      "src/Button.tsx",
      `function Button(props: { label: string; onClick(): void }) {
        return (
          <button id="button" onClick={props.onClick}>
            {props.label}
          </button>
        );
      }

      export {}`
    );
    await preview.show("src/Button.tsx:Button");
    const button = await preview.iframe.waitForSelector("#button");
    await button.click();
    expect(preview.getState()).toMatchObject({
      logs: [
        {
          kind: "log-message",
          level: "log",
          message: "onClick invoked",
        },
      ],
      actions: [
        {
          kind: "action",
          path: "onClick",
          type: "fn",
        },
      ],
    });
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
      }

      export {}`
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
    await button.click();
    expect(preview.getState()).toMatchObject({
      logs: [
        {
          kind: "log-message",
          level: "log",
          message: "onClick callback invoked!",
        },
      ],
      actions: [
        {
          kind: "action",
          path: "onClick",
          type: "fn",
        },
      ],
    });
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
      }

      export {}`
    );
    await preview.show("src/Link.tsx:Link");
    const link = await preview.iframe.waitForSelector("#link");
    await link.click();
    expect(preview.getState()).toMatchObject({
      actions: [
        {
          kind: "action",
          path: "https://www.google.com/",
          type: "url",
        },
      ],
    });
  });
});

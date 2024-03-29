import { test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "preact-app");

test.describe.parallel("preact/jsx", () => {
  const test = previewTest(pluginFactory, testApp);

  test("renders JSX component", async (preview) => {
    await preview.fileManager.update(
      "src/Button.jsx",
      `export const Button = (props) => {
        return <button>
        {props.label || "a button"}
        </button>
      }`
    );
    await preview.show("src/Button.jsx:Button");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'a button')]"
    );
  });

  test("renders JSX props (plain HTML tag)", async (preview) => {
    await preview.fileManager.update(
      "src/Button.jsx",
      `export const Button = (props) => {
        return <button>
          {props.children}
        </button>
      }`
    );
    await preview.show(
      "src/Button.jsx:Button",
      `properties = {
        children: <div>some JSX</div>
      }`
    );
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'some JSX')]"
    );
  });

  test("renders JSX props (other component)", async (preview) => {
    await preview.fileManager.update(
      "src/Button.jsx",
      `export const Button = (props) => {
        return <button>
          {props.children}
        </button>
      }

      const Other = () => <div>Other</div>;`
    );
    await preview.show(
      "src/Button.jsx:Button",
      `properties = {
        children: <Other />
      }`
    );
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'Other')]"
    );
  });
});

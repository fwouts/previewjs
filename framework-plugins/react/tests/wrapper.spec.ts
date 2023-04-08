import { test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";
import { reactVersions } from "./react-versions.js";

const WRAPPER_SOURCE = `import { ReactNode } from "react";
export const Wrapper = ({ children }: { children: ReactNode }) => {
  return <div className="wrapped">{children}</div>;
};
`;

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = (suffix: string | number) =>
  path.join(__dirname, "apps", "react" + suffix);

for (const reactVersion of reactVersions()) {
  test.describe.parallel(`v${reactVersion}`, () => {
    test.describe.parallel("react/wrapper", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("refreshes when wrapper is added", async (preview) => {
        await preview.show("src/App.tsx:App");
        await preview.iframe.waitForSelector(".App");
        await preview.iframe.waitForSelector(".wrapped", {
          state: "hidden",
        });
        await preview.fileManager.update(
          "__previewjs__/Wrapper.tsx",
          WRAPPER_SOURCE
        );
        await preview.iframe.waitForSelector(".wrapped");
      });

      test("refreshes when wrapper is updated", async (preview) => {
        await preview.show("src/App.tsx:App");
        await preview.iframe.waitForSelector(".App");
        await preview.iframe.waitForSelector(".wrapped", {
          state: "hidden",
        });
        await preview.fileManager.update(
          "__previewjs__/Wrapper.tsx",
          WRAPPER_SOURCE
        );
        await preview.iframe.waitForSelector(".wrapped");
        await preview.fileManager.update("__previewjs__/Wrapper.tsx", {
          replace: /wrapped/g,
          with: "wrapped-modified",
        });
        await preview.iframe.waitForSelector(".wrapped-modified");
      });

      test("refreshes when wrapper is removed", async (preview) => {
        await preview.show("src/App.tsx:App");
        await preview.iframe.waitForSelector(".App");
        await preview.iframe.waitForSelector(".wrapped", {
          state: "hidden",
        });
        await preview.fileManager.update(
          "__previewjs__/Wrapper.tsx",
          WRAPPER_SOURCE
        );
        await preview.iframe.waitForSelector(".wrapped");
        await preview.fileManager.remove("__previewjs__/Wrapper.tsx");
        await preview.iframe.waitForSelector(".wrapped", {
          state: "hidden",
        });
      });
    });
  });
}

import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const WRAPPER_SOURCE = `import { ReactNode } from "react";
export const Wrapper = ({ children }: { children: ReactNode }) => {
  return <div className="wrapped">{children}</div>;
};
`;

const testApp = (suffix: string | number) =>
  path.join(__dirname, "apps", "react" + suffix);

for (const reactVersion of [16, 17, 18]) {
  test.describe(`v${reactVersion}`, () => {
    test.describe("react/wrapper", () => {
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

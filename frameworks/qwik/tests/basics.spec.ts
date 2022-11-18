import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = (appName: string) => path.join(__dirname, "apps", appName);

test.describe("qwik/basics", () => {
  const test = previewTest([pluginFactory], testApp("qwik-app"));

  test("shows component", async (preview) => {
    await preview.show("src/components/header/header.tsx:default");
    await preview.iframe.waitForSelector(".App");
  });
});

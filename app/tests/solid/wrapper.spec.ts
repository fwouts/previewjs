import solidPlugin from "@previewjs/plugin-solid";
import { describe, it } from "vitest";

const WRAPPER_SOURCE = `export const Wrapper = ({ children }: { children: JSX.Element }) => {
  return <div className="wrapped">{children}</div>;
};
`;

describe("solid/wrapper", () => {
  it("refreshes when wrapper is added", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await previewIframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
    await appDir.update("__previewjs__/Wrapper.tsx", {
      kind: "replace",
      text: WRAPPER_SOURCE,
    });
    await previewIframe.waitForSelector(".wrapped");
  });

  it("refreshes when wrapper is updated", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await appDir.update("__previewjs__/Wrapper.tsx", {
      kind: "replace",
      text: WRAPPER_SOURCE,
    });
    await previewIframe.waitForSelector(".wrapped");
    await appDir.update("__previewjs__/Wrapper.tsx", {
      kind: "edit",
      search: /wrapped/g,
      replace: "wrapped-modified",
    });
    await previewIframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
    await previewIframe.waitForSelector(".wrapped-modified");
  });

  it("refreshes when wrapper is removed", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await controller.show("src/App.tsx:App");
    const previewIframe = await controller.previewIframe();
    await previewIframe.waitForSelector(".App-logo");
    await appDir.update("__previewjs__/Wrapper.tsx", {
      kind: "replace",
      text: WRAPPER_SOURCE,
    });
    await previewIframe.waitForSelector(".wrapped");
    await appDir.remove("__previewjs__/Wrapper.tsx");
    await previewIframe.waitForSelector(".wrapped", {
      state: "hidden",
    });
  });
});

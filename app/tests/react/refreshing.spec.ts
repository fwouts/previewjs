import { expect, waitFor } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";
import { describe, it } from "vitest";

describe("react/refreshing", () => {
  for (const version of [16, 17, 18]) {
    it("renders top-level component", async (ctx) => {
      const { controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
    });

    it("renders top-level component after file system change", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update("src/App.tsx", {
        kind: "edit",
        search: `className="App"`,
        replace: `className="App-modified"`,
      });
      await previewIframe.waitForSelector(".App-modified");
    });

    it("renders top-level component after in-memory change", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await appDir.update(
        "src/App.tsx",
        {
          kind: "edit",
          search: `className="App"`,
          replace: `className="App-modified"`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await previewIframe.waitForSelector(".App-modified");
    });

    it("renders updated dependency after file system change", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".Dependency");
      await appDir.update("src/Dependency.tsx", {
        kind: "edit",
        search: `className="Dependency"`,
        replace: `className="Dependency-modified"`,
      });
      await previewIframe.waitForSelector(".Dependency-modified");
    });

    it("renders updated dependency after in-memory change", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".Dependency");
      await appDir.update(
        "src/Dependency.tsx",
        {
          kind: "edit",
          search: `className="Dependency"`,
          replace: `className="Dependency-modified"`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await previewIframe.waitForSelector(".Dependency-modified");
    });

    it("renders updated CSS after file system change", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      const dependencyComponent = await previewIframe.waitForSelector(
        ".Dependency"
      );
      expect((await dependencyComponent?.boundingBox())?.width).toEqual(200);
      await appDir.update("src/App.css", {
        kind: "edit",
        search: `width: 200px`,
        replace: `width: 400px`,
      });
      await waitFor(
        async () => (await dependencyComponent?.boundingBox())?.width === 400
      );
    });

    it("renders updated CSS after in-memory change", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      const dependencyComponent = await previewIframe.waitForSelector(
        ".Dependency"
      );
      expect((await dependencyComponent?.boundingBox())?.width).toEqual(200);
      await appDir.update(
        "src/App.css",
        {
          kind: "edit",
          search: `width: 200px`,
          replace: `width: 400px`,
        },
        {
          inMemoryOnly: true,
        }
      );
      await waitFor(
        async () => (await dependencyComponent?.boundingBox())?.width === 400
      );
    });

    it("switches to another component back and forth smoothly in different files", async (ctx) => {
      const { controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await controller.show("src/Other.tsx:Other");
      await previewIframe.waitForSelector(".Other");
      await controller.show("src/App.tsx:App");
      await previewIframe.waitForSelector(".App-logo");
    });

    it("switches to another component back and forth smoothly in same file files", async (ctx) => {
      const { controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await controller.show("src/App.tsx:App");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".App-logo");
      await controller.show("src/App.tsx:Other");
      await previewIframe.waitForSelector(".OtherSameFile");
      await controller.show("src/App.tsx:App");
      await previewIframe.waitForSelector(".App-logo");
    });
  }
});

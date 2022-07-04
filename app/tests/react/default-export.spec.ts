import reactPlugin from "@previewjs/plugin-react";
import { describe, it } from "vitest";

describe("react/default-export", () => {
  for (const version of [16, 17, 18]) {
    it("renders default export component (arrow function)", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/App.tsx", {
        kind: "replace",
        text: `
export default () => {
  return <div className="default-export">
    Hello, World!
  </div>
}
    `,
      });
      await controller.show("src/App.tsx:default");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".default-export");
    });

    it("renders default export component (named function)", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/App.tsx", {
        kind: "replace",
        text: `
export default function test() {
  return <div className="default-export">
    Hello, World!
  </div>
}
    `,
      });
      await controller.show("src/App.tsx:test");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".default-export");
    });

    it("renders default export component (anonymous function)", async (ctx) => {
      const { appDir, controller } = await ctx.setupTest(`react${version}`, [
        reactPlugin,
      ]);
      await appDir.update("src/App.tsx", {
        kind: "replace",
        text: `
export default function() {
  return <div className="default-export">
    Hello, World!
  </div>
}
    `,
      });
      await controller.show("src/App.tsx:default");
      const previewIframe = await controller.previewIframe();
      await previewIframe.waitForSelector(".default-export");
    });
  }
});

import solidPlugin from "@previewjs/plugin-solid";
import { describe, it } from "vitest";

describe("solid/default-export", () => {
  it("renders default export component (arrow function)", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await appDir.update("src/App.tsx", {
      kind: "replace",
      text: `
export const App = () => <div>unused</div>;

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
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await appDir.update("src/App.tsx", {
      kind: "replace",
      text: `
export const App = () => <div>unused</div>;

export default function test() {
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

  it("renders default export component (anonymous function)", async (ctx) => {
    const { appDir, controller } = await ctx.setupTest("solid", [solidPlugin]);
    await appDir.update("src/App.tsx", {
      kind: "replace",
      text: `
export const App = () => <div>unused</div>;

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
});

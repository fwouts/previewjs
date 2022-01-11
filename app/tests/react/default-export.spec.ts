import { testSuite } from "../../testing";

export const defaultExportTests = testSuite("react/default-export", (test) => {
  test(
    "renders default export component (arrow function)",
    "react",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "renders default export component (named function)",
    "react",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "renders default export component (anonymous function)",
    "react",
    async ({ appDir, controller }) => {
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
    }
  );
});

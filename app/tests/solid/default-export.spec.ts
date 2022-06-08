import { testSuite } from "../../testing";

export const defaultExportTests = testSuite("solid/default-export", (test) => {
  test(
    "renders default export component (arrow function)",
    "solid",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "renders default export component (named function)",
    "solid",
    async ({ appDir, controller }) => {
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
    }
  );

  test(
    "renders default export component (anonymous function)",
    "solid",
    async ({ appDir, controller }) => {
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
    }
  );
});

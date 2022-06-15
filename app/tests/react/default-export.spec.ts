import { testSuite } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";

export const defaultExportTests = testSuite(
  [reactPlugin],
  "react/default-export",
  (test) => {
    for (const version of [16, 17, 18]) {
      test(
        `${version}/renders default export component (arrow function)`,
        `react${version}`,
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
        `${version}/renders default export component (named function)`,
        `react${version}`,
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
        `${version}/renders default export component (anonymous function)`,
        `react${version}`,
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
    }
  }
);

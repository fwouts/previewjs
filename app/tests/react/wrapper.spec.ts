import { testSuite } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";

const WRAPPER_SOURCE = `import { ReactNode } from "react";
export const Wrapper = ({ children }: { children: ReactNode }) => {
  return <div className="wrapped">{children}</div>;
};
`;

export const wrapperTests = testSuite(
  [reactPlugin],
  "react/wrapper",
  (test) => {
    for (const version of [16, 17, 18]) {
      test(
        `${version}/refreshes when wrapper is added`,
        `react${version}`,
        async ({ appDir, controller }) => {
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
        }
      );

      test(
        `${version}/refreshes when wrapper is updated`,
        `react${version}`,
        async ({ appDir, controller }) => {
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
        }
      );

      test(
        `${version}/refreshes when wrapper is removed`,
        `react${version}`,
        async ({ appDir, controller }) => {
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
        }
      );
    }
  }
);

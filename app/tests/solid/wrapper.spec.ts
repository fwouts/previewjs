import solidPlugin from "@previewjs/plugin-solid";
import { testSuite } from "../../testing";

const WRAPPER_SOURCE = `export const Wrapper = ({ children }: { children: JSX.Element }) => {
  return <div className="wrapped">{children}</div>;
};
`;

export const wrapperTests = testSuite(
  [solidPlugin],
  "solid/wrapper",
  (test) => {
    test(
      "refreshes when wrapper is added",
      "solid",
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
      "refreshes when wrapper is updated",
      "solid",
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
      "refreshes when wrapper is removed",
      "solid",
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
);

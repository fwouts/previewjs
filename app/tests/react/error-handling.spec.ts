import { expect, testSuite } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";

export const errorHandlingTests = testSuite(
  [reactPlugin],
  "react/error handling",
  (test) => {
    for (const version of [16, 17, 18]) {
      test(
        `${version}/notifies the user when server is not reachable`,
        `react${version}`,
        async ({ controller }) => {
          await controller.show("src/App.tsx:App");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(".App-logo");
          await controller.stop();
          await controller.appError.waitUntilVisible();
          expect(await controller.appError.text()).toEqual(
            "Server disconnected. Is Preview.js still running?"
          );
          await controller.start();
          await controller.appError.waitUntilGone();
        }
      );
    }
  }
);

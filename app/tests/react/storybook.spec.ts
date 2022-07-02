import { testSuite } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";

export const storybookTests = testSuite(
  [reactPlugin],
  "react/storybook",
  (test) => {
    for (const version of [16, 17, 18]) {
      test(
        `${version}/renders component with explicit args`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/Button.tsx", {
            kind: "replace",
            text: `
  const Button = ({ label }) => <button>{label}</button>;
  Button.args = {
    label: "Hello, World!"
  };
      `,
          });
          await controller.show("src/Button.tsx:Button");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello, World!')]"
          );
        }
      );

      test(
        `${version}/renders component with default args`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/Button.tsx", {
            kind: "replace",
            text: `
  const Button = ({ label }) => <button>{label}</button>;
  
  export default {
    args: {
      label: "Hello, World!"
    }
  };
      `,
          });
          await controller.show("src/Button.tsx:Button");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello, World!')]"
          );
        }
      );

      test(
        `${version}/renders component with explicit args over default args`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/Button.tsx", {
            kind: "replace",
            text: `
  const Button = ({ label }) => <button>{label}</button>;
  Button.args = {
    label: "explicit"
  };
  
  export default {
    args: {
      label: "default"
    }
  };
      `,
          });
          await controller.show("src/Button.tsx:Button");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'explicit')]"
          );
        }
      );
    }
  }
);

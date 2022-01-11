import { testSuite } from "../../testing";

export const storybookTests = testSuite("react/storybook", (test) => {
  test(
    "renders component with args",
    "react",
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
});

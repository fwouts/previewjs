import { testSuite } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";

export const storybookTests = testSuite(
  [reactPlugin],
  "react/storybook",
  (test) => {
    for (const version of [16, 17, 18]) {
      test(
        `${version}/renders CSF2 story with explicit args`,
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
        `${version}/renders CSF2 story with default args`,
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
        `${version}/renders CSF2 story with explicit args over default args`,
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

      test(
        `${version}/renders CSF3 story with explicit args`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/Button.tsx", {
            kind: "replace",
            text: `
  const Button = ({ label }) => <button>{label}</button>;
  
  export default {
    component: Button
  }

  export const Example = {
    args: {
      label: "Hello, World!"
    }
  }
            `,
          });
          await controller.show("src/Button.tsx:Example");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello, World!')]"
          );
        }
      );

      test(
        `${version}/renders CSF3 story with default args`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/Button.tsx", {
            kind: "replace",
            text: `
  const Button = ({ label }) => <button>{label}</button>;

  export default {
    component: Button,
    args: {
      label: "Hello, World!"
    }
  };

  export const Example = {};
      `,
          });
          await controller.show("src/Button.tsx:Example");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello, World!')]"
          );
        }
      );

      test(
        `${version}/renders CSF3 story with explicit args over default args`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/Button.tsx", {
            kind: "replace",
            text: `
  const Button = ({ label }) => <button>{label}</button>;

  export default {
    component: Button,
    args: {
      label: "default"
    }
  };

  export const Example = {
    args: {
      label: "explicit"
    }
  };
      `,
          });
          await controller.show("src/Button.tsx:Example");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'explicit')]"
          );
        }
      );

      test(
        `${version}/renders CSF3 story with render function`,
        `react${version}`,
        async ({ appDir, controller }) => {
          await appDir.update("src/Button.tsx", {
            kind: "replace",
            text: `
  const Button = ({ label }) => <button>{label}</button>;
  
  export default {
    component: () => <div>foo</div>
  }

  export const Example = {
    args: {
      label: "Hello, World!"
    },
    render: (args) => <Button {...args} />
  }
            `,
          });
          await controller.show("src/Button.tsx:Example");
          const previewIframe = await controller.previewIframe();
          await previewIframe.waitForSelector(
            "xpath=//button[contains(., 'Hello, World!')]"
          );
        }
      );
    }
  }
);

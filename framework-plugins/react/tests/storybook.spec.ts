import { test } from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";
import { reactVersions } from "./react-versions.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const testApp = (suffix: string | number) =>
  path.join(__dirname, "apps", "react" + suffix);

for (const reactVersion of reactVersions()) {
  test.describe.parallel(`v${reactVersion}`, () => {
    test.describe.parallel("react/storybook", () => {
      const test = previewTest(pluginFactory, testApp(reactVersion));

      test("renders CSF2 story with no args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button
          };

          export const ButtonStory = () => <Button label="Hello, World!" />;`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "Hello, World!",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF2 story with explicit args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button
          };

          export const ButtonStory = Button.bind({});
          ButtonStory.args = {
            label: "explicit"
          };`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'explicit')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "explicit",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF2 story with assignment source referring local variable", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button
          };

          const baseArgs = {
            label: "local value"
          };

          export const ButtonStory = Button.bind({});
          ButtonStory.args = {
            label: "label"
          };`
        );
        await preview.show(
          "src/Button.tsx:ButtonStory",
          `properties = {
            ...baseArgs
          }`
        );
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'local value')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "local value",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF2 story with default args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default export"
            }
          };

          export const ButtonStory = Button.bind({});`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'default export')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "default export",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF2 story with explicit args over default args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default export"
            }
          };

          export const ButtonStory = Button.bind({});
          ButtonStory.args = {
            label: "explicit"
          };`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'explicit')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "explicit",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF3 story with explicit args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button
          }

          export const ButtonStory = {
            args: {
              label: "explicit"
            }
          }`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'explicit')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "explicit",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF3 story with assignment source referring local variable", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button
          }

          const baseArgs = {
            label: "local value"
          };

          export const ButtonStory = {
            args: {
              label: "label"
            }
          }`
        );
        await preview.show(
          "src/Button.tsx:ButtonStory",
          `properties = {
            ...baseArgs
          }`
        );
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'local value')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "local value",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF3 story with default args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default export"
            }
          }

          export const ButtonStory = {};`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'default export')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "default export",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF3 story with explicit args over default args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default export"
            }
          };

          export const ButtonStory = {
            args: {
              label: "explicit"
            }
          };`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'explicit')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "explicit",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });

      test("renders CSF3 story with render function", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button
          };

          export const ButtonStory = {
            args: {
              label: "Hello, World!"
            },
            render: (args) => <Button {...args} />
          };`
        );
        await preview.show("src/Button.tsx:ButtonStory");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
        await preview.fileManager.update("src/Button.tsx", {
          replace: "Hello, World!",
          with: "Hi, World!",
        });
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hi, World!')]"
        );
      });
    });
  });
}

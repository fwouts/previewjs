import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import url from "url";
import pluginFactory from "../src/index.js";

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
const testApp = path.join(__dirname, "apps", "preact-app");

test.describe.parallel("preact/storybook", () => {
  const test = previewTest([pluginFactory], testApp);

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
  });

  test("renders CSF2 story with default args", async (preview) => {
    await preview.fileManager.update(
      "src/Button.tsx",
      `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default"
            }
          };

          export const ButtonStory = Button.bind({});`
    );
    await preview.show("src/Button.tsx:ButtonStory");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'default')]"
    );
  });

  test("renders CSF2 story with explicit args over default args", async (preview) => {
    await preview.fileManager.update(
      "src/Button.tsx",
      `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default"
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
  });

  test("renders CSF3 story with default args", async (preview) => {
    await preview.fileManager.update(
      "src/Button.tsx",
      `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default"
            }
          }

          export const ButtonStory = {};`
    );
    await preview.show("src/Button.tsx:ButtonStory");
    await preview.iframe.waitForSelector(
      "xpath=//button[contains(., 'default')]"
    );
  });

  test("renders CSF3 story with explicit args over default args", async (preview) => {
    await preview.fileManager.update(
      "src/Button.tsx",
      `const Button = ({ label }) => <button>{label}</button>;

          export default {
            component: Button,
            args: {
              label: "default"
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
  });
});

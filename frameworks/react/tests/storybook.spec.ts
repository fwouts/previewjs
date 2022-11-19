import test from "@playwright/test";
import { previewTest } from "@previewjs/testing";
import path from "path";
import pluginFactory from "../src";

test.describe.configure({ mode: "parallel" });

const testApp = (suffix: string | number) =>
  path.join(__dirname, "../../../test-apps/react" + suffix);

for (const reactVersion of [16, 17, 18]) {
  test.describe(`v${reactVersion}`, () => {
    test.describe("react/storybook", () => {
      const test = previewTest([pluginFactory], testApp(reactVersion));

      test("renders CSF2 story with no args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;
          
          const ButtonStory = () => <Button label="Hello, World!" />;

          export default {
            component: Button
          }`
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
            args: {
              label: "Hello, World!"
            }
          };`
        );
        await preview.show("src/Button.tsx:Button");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      });

      test("renders CSF2 story with explicit args over default args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;
          Button.args = {
            label: "explicit"
          };
          
          export default {
            args: {
              label: "default"
            }
          };`
        );
        await preview.show("src/Button.tsx:Button");
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
        
          export const Example = {
            args: {
              label: "Hello, World!"
            }
          }`
        );
        await preview.show("src/Button.tsx:Example");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      });

      test("renders CSF3 story with default args", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;
  
          export default {
            component: Button,
            args: {
              label: "Hello, World!"
            }
          }
        
          export const Example = {};`
        );
        await preview.show("src/Button.tsx:Example");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
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
        
          export const Example = {
            args: {
              label: "explicit"
            }
          };`
        );
        await preview.show("src/Button.tsx:Example");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'explicit')]"
        );
      });

      test("renders CSF3 story with render function", async (preview) => {
        await preview.fileManager.update(
          "src/Button.tsx",
          `const Button = ({ label }) => <button>{label}</button>;
  
          export default {
            component: () => <div>foo</div>
          };
        
          export const Example = {
            args: {
              label: "Hello, World!"
            },
            render: (args) => <Button {...args} />
          };`
        );
        await preview.show("src/Button.tsx:Example");
        await preview.iframe.waitForSelector(
          "xpath=//button[contains(., 'Hello, World!')]"
        );
      });
    });
  });
}

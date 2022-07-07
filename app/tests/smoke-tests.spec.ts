import { testSuite } from "@previewjs/e2e-test-runner";
import reactPlugin from "@previewjs/plugin-react";
import solidPlugin from "@previewjs/plugin-solid";
import vue2Plugin from "@previewjs/plugin-vue2";
import vue3Plugin from "@previewjs/plugin-vue3";
import fs from "fs-extra";
import path from "path";

const smokeTestAppsDir = path.join(__dirname, "..", "..", "smoke-test-apps");
export const smokeTests = fs
  .readdirSync(smokeTestAppsDir)
  .filter((appName) =>
    fs.pathExistsSync(path.join(smokeTestAppsDir, appName, "package.json"))
  )
  .map((appName) =>
    testSuite(
      [reactPlugin, solidPlugin, vue2Plugin, vue3Plugin],
      `smoke test: ${appName}`,
      async (test) => {
        test(
          appName,
          `../smoke-test-apps/${appName}`,
          async ({ appDir, controller }) => {
            const candidates = [
              "App.tsx:App",
              "App.jsx:App",
              "App.js:App",
              "src/App.tsx:App",
              "src/App.jsx:App",
              "src/App.js:App",
              "src/App.vue:App",
              "src/SolidApp.jsx:default",
              "pages/index.tsx:App",
              "pages/index.vue:index",
              "app.vue:app",
            ];
            let absoluteFilePath: string | null = null;
            let componentName: string | null = null;
            for (const candidate of candidates) {
              const colonPosition = candidate.indexOf(":");
              const candidatePath = candidate.substr(0, colonPosition);
              if (
                await fs.pathExists(path.join(appDir.rootPath, candidatePath))
              ) {
                absoluteFilePath = path.join(appDir.rootPath, candidatePath);
                componentName = candidate.substr(colonPosition + 1);
                break;
              }
            }
            if (!absoluteFilePath || !componentName) {
              throw new Error(`Unable to find an entry point for ${appName}`);
            }
            await controller.show(
              `${path
                .relative(appDir.rootPath, absoluteFilePath)
                .replace(/\\/g, "/")}:${componentName}`
            );
            const iframe = await controller.previewIframe();
            await iframe.waitForSelector("#ready");
            if (await controller.props.editor.visible()) {
              await controller.props.editor.isReady();
            }
            await controller.takeScreenshot(
              "#ready",
              path.join(
                __dirname,
                "..",
                "tests",
                "__screenshots__",
                process.platform,
                `${appName}.png`
              )
            );
          }
        );
      },
      path.join(smokeTestAppsDir, appName),
      false
    )
  );

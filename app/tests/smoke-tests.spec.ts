import fs from "fs-extra";
import path from "path";
import { testSuite } from "../testing";

const smokeTestAppsDir = path.join(__dirname, "..", "..", "smoke-test-apps");
export const smokeTests = fs
  .readdirSync(smokeTestAppsDir)
  .filter(
    (appName) =>
      !appName.startsWith("_tmp_") &&
      fs.pathExistsSync(path.join(smokeTestAppsDir, appName, "package.json"))
  )
  .map((appName) =>
    testSuite(
      `smoke test: ${appName}`,
      async (test) => {
        test(
          appName,
          `../smoke-test-apps/${appName}`,
          async ({ outputDirPath, appDir, controller }) => {
            const candidates = [
              "App.tsx:App",
              "App.jsx:App",
              "App.js:App",
              "src/App.tsx:App",
              "src/App.jsx:App",
              "src/App.js:App",
              "src/App.vue:App",
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
                outputDirPath,
                "__screenshots__",
                process.platform,
                `${appName}.png`
              )
            );
          }
        );
      },
      path.join(smokeTestAppsDir, appName)
    )
  );

import fs from "fs-extra";
import path from "path";
import { testSuite } from "../testing";

export const smokeTests = testSuite("smoke tests", async (test) => {
  const smokeTestAppsDir = path.join(__dirname, "..", "..", "smoke-test-apps");
  for (const appName of await fs.readdir(smokeTestAppsDir)) {
    if (appName === "tmp") {
      continue;
    }
    if (
      !fs.pathExistsSync(path.join(smokeTestAppsDir, appName, "package.json"))
    ) {
      // This is not a valid test app.
      // For example, it may be a temporary file.
      continue;
    }
    test(
      appName,
      `../smoke-test-apps/${appName}`,
      async ({ outputDirPath, appDir, controller }) => {
        const candidates = [
          "src/App.tsx:App",
          "src/App.jsx:App",
          "src/App.js:App",
          "src/App.vue:App",
          "pages/index.tsx:App",
          "pages/index.vue:index",
          "app.vue:app",
        ];
        let filePath: string | null = null;
        let componentName: string | null = null;
        for (const candidate of candidates) {
          const colonPosition = candidate.indexOf(":");
          const candidatePath = candidate.substr(0, colonPosition);
          if (await fs.pathExists(path.join(appDir.rootPath, candidatePath))) {
            filePath = path.join(appDir.rootPath, candidatePath);
            componentName = candidate.substr(colonPosition + 1);
            break;
          }
        }
        if (!filePath || !componentName) {
          throw new Error(`Unable to find an entry point for ${appName}`);
        }
        await controller.show(
          `${path
            .relative(appDir.rootPath, filePath)
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
  }
});

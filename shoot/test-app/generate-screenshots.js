import reactPlugin from "@previewjs/plugin-react";
import { generateScreenshots } from "@previewjs/shoot";
import playwright from "playwright";

async function main() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await generateScreenshots({
    page,
    frameworkPlugins: [reactPlugin],
    generateScreenshotPath({ filePath, name }) {
      return `${filePath}-${name}.png`;
    },
    onScreenshot({ filePath, name }) {
      console.log(`${filePath} 📸 ${name}`);
    },
  });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

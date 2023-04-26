import reactPlugin from "@previewjs/plugin-react";
import { generateScreenshots } from "@previewjs/screenshot";
import playwright from "playwright";

const browser = await playwright.chromium.launch();
const page = await browser.newPage();
await generateScreenshots({
  page,
  frameworkPlugins: [reactPlugin],
  filePathPattern: "**/*.{jsx,tsx}",
  generateScreenshotPath({ filePath, name }) {
    return `${filePath}-${name}.png`;
  },
  onScreenshotGenerated({ filePath, name }) {
    console.log(`${filePath} 📸 ${name}`);
  },
});
await browser.close();

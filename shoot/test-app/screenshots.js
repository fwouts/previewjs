const playwright = require("playwright");

async function main() {
  const { generateScreenshots } = await import("@previewjs/shoot");
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  await generateScreenshots({
    page,
    frameworkPlugins: [(await import("@previewjs/plugin-react")).default],
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

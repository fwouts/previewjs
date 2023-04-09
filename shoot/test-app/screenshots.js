const playwright = require("playwright");

async function main() {
  const { generateScreenshots } = await import("@previewjs/shoot");
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage();
  const screenshots = await generateScreenshots({
    page,
    frameworkPlugins: [(await import("@previewjs/plugin-react")).default],
  });
  console.log(screenshots);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

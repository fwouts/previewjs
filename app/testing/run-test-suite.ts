import path from "path";
import playwright from "playwright";
import { runTests } from ".";

async function main() {
  let failed = false;
  const groupCount = parseInt(process.env.GROUP_COUNT || "1");
  const groupIndex = parseInt(process.env.GROUP_INDEX || "0");
  const port = parseInt(process.env.PORT || "8100");
  const setupEnvironmentPath = path.resolve(
    __dirname,
    process.env.SETUP_ENVIRONMENT_MODULE || "../src"
  );
  const testsPath = path.resolve(
    __dirname,
    process.env.TESTS_MODULE || "../tests"
  );
  const headless = process.env.HEADLESS !== "0";
  const browser = await playwright.chromium.launch({
    headless,
    devtools: !headless,
  });
  try {
    const startTimeMillis = Date.now();
    const setupEnvironment = (await import(setupEnvironmentPath)).default;
    const testSuitesPromises = (await import(testsPath)).default;
    const testSuites = await Promise.all(testSuitesPromises);
    const { testCasesCount, failedTests } = await runTests({
      browser,
      setupEnvironment,
      testSuites: testSuites.filter(
        (_, index) => index % groupCount === groupIndex
      ),
      filters: process.argv.slice(2),
      outputDirPath: testsPath,
      port: port + groupIndex,
    });
    const totalDurationMillis = Date.now() - startTimeMillis;
    console.log(
      `Test summary (group ${groupIndex}/${groupCount}):\n${testCasesCount} test cases run, ${
        failedTests.length
      } failed.\nTotal time: ${totalDurationMillis / 1000}s.`
    );
    if (failedTests.length > 0) {
      console.error(`The following tests failed:`);
      for (const name of failedTests) {
        console.error(`• ${name}`);
      }
      failed = true;
    }
  } finally {
    await browser.close();
  }
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

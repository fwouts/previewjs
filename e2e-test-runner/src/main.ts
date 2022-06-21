import { program } from "commander";
import path from "path";
import playwright from "playwright";
import { runTests } from "./test-runner";

program
  .option("-s, --setup-module <module-path>")
  .option("-t, --tests-dir <tests-dir>")
  .option("-f, --filter [filters...]")
  .action(async ({ setupModule, testsDir, filter = [] }) => {
    let failed = false;
    const groupCount = parseInt(process.env.GROUP_COUNT || "1");
    const groupIndex = parseInt(process.env.GROUP_INDEX || "0");
    const port = parseInt(process.env.PORT || "8100");
    const setupEnvironmentPath = path.resolve(setupModule);
    const testsPath = path.resolve(testsDir);
    const headless = process.env.HEADLESS !== "0";
    const browser = await playwright.chromium.launch({
      headless,
      devtools: !headless,
    });
    try {
      const startTimeMillis = Date.now();
      let setupEnvironment = (await import(setupEnvironmentPath)).default;
      let testSuitesPromises = (await import(testsPath)).default;

      // Workaround for Rollup CJS bug.
      if (setupEnvironment.default) {
        setupEnvironment = setupEnvironment.default;
      }
      if (testSuitesPromises.default) {
        testSuitesPromises = testSuitesPromises.default;
      }

      const testSuites = await Promise.all(testSuitesPromises);
      const { testCasesCount, failedTests } = await runTests({
        browser,
        setupEnvironment,
        testSuites: testSuites.filter(
          (_, index) => index % groupCount === groupIndex
        ),
        filters: filter,
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
  });

program.parseAsync(process.argv).catch((e) => {
  console.error(e);
  process.exit(1);
});

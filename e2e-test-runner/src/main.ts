import { program } from "commander";
import fs from "fs-extra";
import path from "path";
import playwright from "playwright";
import { runTests } from "./test-runner";

program
  .option("-s, --setup-module <module-path>")
  .option("-t, --tests-path <tests-path>")
  .option("-f, --filter [filters...]")
  .option("-r, --repeat <times>")
  .action(async ({ setupModule, testsPath, filter = [], repeat = 1 }) => {
    let failed = false;
    const groupCount = parseInt(process.env.GROUP_COUNT || "1");
    const groupIndex = parseInt(process.env.GROUP_INDEX || "0");
    const port = parseInt(process.env.PORT || "8100");
    const setupEnvironmentPath = path.resolve(setupModule);
    const testsResolvedPath = path.resolve(testsPath);
    const outputDirPath = fs.lstatSync(testsResolvedPath).isDirectory()
      ? testsResolvedPath
      : path.dirname(testsResolvedPath);
    const headless = process.env.HEADLESS !== "0";
    const browser = await playwright.chromium.launch({
      headless,
      devtools: !headless,
    });
    try {
      const startTimeMillis = Date.now();
      let setupEnvironment = (await import(`file://${setupEnvironmentPath}`))
        .default;
      let testSuitesPromises = (await import(`file://${testsResolvedPath}`))
        .default;

      // Workaround for Rollup CJS bug.
      if (setupEnvironment.default) {
        setupEnvironment = setupEnvironment.default;
      }
      if (testSuitesPromises.default) {
        testSuitesPromises = testSuitesPromises.default;
      }

      const testSuites = await Promise.all(testSuitesPromises);
      for (let i = 0; i < repeat; i++) {
        const { testCasesCount, failedTests } = await runTests({
          browser,
          setupEnvironment,
          testSuites: testSuites.filter(
            (_, index) => index % groupCount === groupIndex
          ),
          filters: filter,
          outputDirPath,
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
          break;
        }
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

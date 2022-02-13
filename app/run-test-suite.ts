import path from "path";
import playwright from "playwright";
import setupEnvironment from "./src";
import { runTests } from "./testing";
import testSuitesPromises from "./tests";

async function main() {
  const headless = process.env["HEADLESS"] !== "0";
  const groupCount = parseInt(process.env["GROUP_COUNT"] || "10");
  const browser = await playwright.chromium.launch({
    headless,
    devtools: !headless,
  });
  try {
    const promises: Array<
      Promise<{
        testCasesCount: number;
        failedTests: string[];
      }>
    > = [];
    const startTimeMillis = Date.now();
    const testSuites = await Promise.all(testSuitesPromises);
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      promises.push(
        runTests({
          browser,
          setupEnvironment,
          testSuites: testSuites.filter(
            (_, index) => index % groupCount === groupIndex
          ),
          filters: process.argv.slice(2),
          outputDirPath: path.join(__dirname, "tests"),
          port: 8100 + groupIndex,
        })
      );
    }
    const { testCasesCount, failedTests } = (
      await Promise.all(promises)
    ).reduce(
      (acc, curr) => {
        acc.testCasesCount += curr.testCasesCount;
        acc.failedTests.push(...curr.failedTests);
        return acc;
      },
      {
        testCasesCount: 0,
        failedTests: [],
      }
    );
    const totalDurationMillis = Date.now() - startTimeMillis;
    console.log(
      `Test summary:\n${testCasesCount} test cases run, ${
        failedTests.length
      } failed.\nTotal time: ${totalDurationMillis / 1000}s.`
    );
    if (failedTests.length > 0) {
      console.error(`The following tests failed:`);
      for (const name of failedTests) {
        console.error(`• ${name}`);
      }
      process.exit(1);
    }
    process.exit(0);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

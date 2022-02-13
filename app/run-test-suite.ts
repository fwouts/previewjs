import path from "path";
import playwright from "playwright";
import setupEnvironment from "./src";
import { runTests } from "./testing";
import testSuitesPromises from "./tests";

async function main() {
  const chromiumWsEndpoint = process.env["CHROMIUM_WS_ENDPOINT"];
  if (!chromiumWsEndpoint) {
    throw new Error(`Missing env variable: CHROMIUM_WS_ENDPOINT`);
  }
  const groupCount = parseInt(process.env["GROUP_COUNT"] || "1");
  const groupIndex = parseInt(process.env["GROUP_INDEX"] || "0");
  const browser = await playwright.chromium.connect(chromiumWsEndpoint);
  const startTimeMillis = Date.now();
  const testSuites = await Promise.all(testSuitesPromises);
  const { testCasesCount, failedTests } = await runTests({
    browser,
    setupEnvironment,
    testSuites: testSuites.filter(
      (_, index) => index % groupCount === groupIndex
    ),
    filters: process.argv.slice(2),
    outputDirPath: path.join(__dirname, "tests"),
    port: 8100 + groupIndex,
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
    process.exit(1);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

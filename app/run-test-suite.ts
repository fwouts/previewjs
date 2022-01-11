import path from "path";
import setupEnvironment from "./src";
import { runTests } from "./testing";
import testSuites from "./tests";

async function main() {
  await runTests({
    setupEnvironment,
    testSuites,
    processArgs: process.argv,
    outputDirPath: path.join(__dirname, "tests"),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

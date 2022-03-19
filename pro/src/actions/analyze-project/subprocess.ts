// This is meant to be invoked via fork() to analyze a project in a subprocess
// in order to prevent the parent process from freezing.

import { analyzeProjectCore } from "./core";

const rootDirPath = process.argv[2]!;
if (!rootDirPath) {
  throw new Error("No directory specified.");
}

analyzeProjectCore(rootDirPath)
  .then((components) => {
    process.send!(components);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

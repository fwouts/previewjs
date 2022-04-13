// This is meant to be invoked via fork() to analyze a project in a subprocess
// in order to prevent the parent process from freezing.

import { analyzeProject } from "../analyze-project";

const rootDirPath = process.argv[2]!;
const options = JSON.parse(process.argv[3]!);
if (!rootDirPath) {
  throw new Error("No directory specified.");
}

analyzeProject(rootDirPath, options)
  .then((components) => {
    process.send!(components);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

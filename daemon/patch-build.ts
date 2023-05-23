// For some reason, index.mjs ends up with an incorrect import
// that looks like `import ... from 'process/'`.
//
// This script removes the unwanted slash.

import fs from "fs";

const indexFilePath = "dist/index.mjs";
const indexContent = fs.readFileSync(indexFilePath, "utf8");
fs.writeFileSync(
  indexFilePath,
  indexContent.replace(`'process/'`, `'process'`),
  "utf8"
);

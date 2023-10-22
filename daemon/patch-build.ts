// For some reason, we end up with an incorrect import
// that looks like `import ... from 'process/'`.
//
// This script removes the unwanted slash.

import fs from "fs";
import path from "path";

visit("./dist");

function visit(dirPath: string) {
  for (const f of fs.readdirSync(dirPath)) {
    const filePath = path.join(dirPath, f);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      const content = fs.readFileSync(filePath, "utf8");
      fs.writeFileSync(
        filePath,
        content.replace(`'process/'`, `'process'`),
        "utf8"
      );
    } else if (stat.isDirectory()) {
      visit(filePath);
    }
  }
}

import checker from "license-checker";
import path from "path";

checker.init(
  {
    start: path.join(__dirname, ".."),
    // @ts-ignore
    exclude: [
      "Apache-2.0",
      "BSD-2-Clause",
      "BSD-3-Clause",
      "CC-BY-4.0",
      "ISC",
      "MIT",
      "MPL-2.0",
    ].join(","),
  },
  (err, modules) => {
    if (err) {
      console.error(err);
      process.exit(1);
    }
    modules = Object.fromEntries(
      Object.entries(modules).filter(
        ([name]) => !name.startsWith("@previewjs/")
      )
    );
    if (Object.entries(modules).length > 0) {
      console.error(`Some packages have incompatible licenses:`);
      console.error(modules);
      process.exit(1);
    }
  }
);

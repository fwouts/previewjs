import checker from "license-checker";
import path from "path";
import { inspect } from "util";

const start = path.join(__dirname, "..");

async function main() {
  const allPackages = await extractPackages(start, []);
  // Check that we don't get false negatives by missing packages.
  for (const packageName of [
    "@previewjs/app",
    "mobx-react-lite",
    "@fortawesome/react-fontawesome",
    "@svgr/core",
  ]) {
    if (!allPackages.find(({ name }) => name === packageName)) {
      throw new Error(`Expected to find package: ${packageName}`);
    }
  }
  const incompatibleLicensePackages = await extractPackages(start, [
    "Apache-2.0",
    "BSD-2-Clause",
    "BSD-3-Clause",
    "CC-BY-4.0",
    "ISC",
    "MIT",
    "MPL-2.0",
  ]);
  const nonPreviewJsPackages = incompatibleLicensePackages.filter(
    ({ name }) => !name.startsWith("@previewjs/")
  );
  if (nonPreviewJsPackages.length > 0) {
    throw new Error(
      `Some packages have incompatible licenses:\n${inspect(
        nonPreviewJsPackages
      )}`
    );
  }
  console.log(`All is good!`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

type PackageInfo = {
  name: string;
  version: string;
  licenses?: string | string[];
};

async function extractPackages(
  start: string,
  excludeLicenses: string[]
): Promise<PackageInfo[]> {
  return new Promise<PackageInfo[]>((resolve, reject) =>
    checker.init(
      {
        start,
        // @ts-ignore
        exclude: excludeLicenses.join(","),
      },
      (err, modules) => {
        if (err) {
          reject(err);
          return;
        }
        const packages: PackageInfo[] = [];
        for (const [packageNameWithVersion, info] of Object.entries(modules)) {
          const atSignPosition = packageNameWithVersion.lastIndexOf("@");
          const name = packageNameWithVersion.substring(0, atSignPosition);
          const version = packageNameWithVersion.substring(atSignPosition + 1);
          packages.push({
            name,
            version,
            licenses: info.licenses,
          });
        }
        resolve(packages);
      }
    )
  );
}

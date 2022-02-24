import { install } from "@previewjs/loader";
import path from "path";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }
  const packageVersion = process.env.PREVIEWJS_PACKAGE_VERSION;
  if (!packageVersion) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_VERSION`);
  }

  await install({
    installDir: path.join(__dirname, "installed"),
    packageName,
    packageVersion,
    onOutput: (chunk) => process.stdout.write(chunk),
  });
}

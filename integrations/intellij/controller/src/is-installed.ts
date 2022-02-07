import { isInstalled } from "@previewjs/loader";
import path from "path";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const packageName = process.env["PREVIEWJS_PACKAGE_NAME"];
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }
  const packageVersion = process.env["PREVIEWJS_PACKAGE_VERSION"];
  if (!packageVersion) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_VERSION`);
  }

  const installed = await isInstalled({
    installDir: path.join(__dirname, "installed"),
    packageName,
    packageVersion,
  });
  process.stdout.write(installed ? "installed" : "missing");
}

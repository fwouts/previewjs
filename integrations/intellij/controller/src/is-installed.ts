import { isInstalled, requireEnvVar } from "@previewjs/loader";
import path from "path";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const installed = await isInstalled({
    installDir: path.join(__dirname, "installed"),
    packageName: requireEnvVar("PREVIEWJS_PACKAGE_NAME"),
    packageVersion: requireEnvVar("PREVIEWJS_PACKAGE_VERSION"),
  });
  process.stdout.write(installed ? "installed" : "missing");
}

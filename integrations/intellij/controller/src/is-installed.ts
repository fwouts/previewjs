import { isInstalled } from "@previewjs/loader";
import { getInstallDir, getPackageNameFromEnvironment } from "./config";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  const installed = await isInstalled({
    installDir: getInstallDir(),
    packageName: getPackageNameFromEnvironment(),
  });
  process.stdout.write(installed ? "installed" : "missing");
}

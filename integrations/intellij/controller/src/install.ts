import { install } from "@previewjs/loader";
import { getInstallDir, getPackageNameFromEnvironment } from "./config";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  await install({
    installDir: getInstallDir(),
    packageName: getPackageNameFromEnvironment(),
    onOutput: (chunk) => process.stdout.write(chunk),
  });
}

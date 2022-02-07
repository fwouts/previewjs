import { install, requireEnvVar } from "@previewjs/loader";
import path from "path";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

async function main() {
  await install({
    installDir: path.join(__dirname, "installed"),
    packageName: requireEnvVar("PREVIEWJS_PACKAGE_NAME"),
    packageVersion: requireEnvVar("PREVIEWJS_PACKAGE_VERSION"),
    onOutput: (chunk) => process.stdout.write(chunk),
  });
}

import { ensureServerRunning } from "@previewjs/server";
import { getInstallDir, getPackageNameFromEnvironment } from "./config";

const port = parseInt(process.env.PORT || "9100");
const version = process.env.PREVIEWJS_INTELLIJ_VERSION;

if (!version) {
  throw new Error(`IntelliJ version was not set`);
}

ensureServerRunning({
  loaderInstallDir: getInstallDir(),
  packageName: getPackageNameFromEnvironment(),
  versionCode: `intellij-${version}`,
  port,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

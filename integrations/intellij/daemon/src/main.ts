import { startDaemon } from "@previewjs/daemon";
import url from "url";

const port = parseInt(process.argv[2] || "0", 10);
if (!port) {
  throw new Error(`No port specified`);
}

const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
if (!packageName) {
  throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
}

const version = process.env.PREVIEWJS_INTELLIJ_VERSION;
if (!version) {
  throw new Error(`Missing environment variable: PREVIEWJS_INTELLIJ_VERSION`);
}

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
startDaemon({
  loaderInstallDir: __dirname,
  packageName,
  versionCode: `intellij-${version}`,
  port,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

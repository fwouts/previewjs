import { startDaemon } from "@previewjs/daemon";
import path from "path";
import url from "url";

const port = parseInt(process.argv[2] || "0", 10);
if (!port) {
  throw new Error(`No port specified`);
}

const onServerStartModuleName = process.env.PREVIEWJS_PACKAGE_NAME;
if (!onServerStartModuleName) {
  throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
}

const version = process.env.PREVIEWJS_INTELLIJ_VERSION;
if (!version) {
  throw new Error(`Missing environment variable: PREVIEWJS_INTELLIJ_VERSION`);
}

const __dirname = url.fileURLToPath(new URL(".", import.meta.url));
startDaemon({
  loaderInstallDir: process.env.PREVIEWJS_MODULES_DIR || __dirname,
  loaderWorkerPath: path.join(__dirname, "worker.js"),
  onServerStartModuleName,
  versionCode: `intellij-${version}`,
  port,
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

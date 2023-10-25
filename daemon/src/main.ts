import { startDaemon } from "./index.js";

const port = parseInt(process.env.PORT || "9100");

const onServerStartModuleName =
  process.env.PREVIEWJS_PACKAGE_NAME || "@previewjs/pro";

const loaderInstallDir = process.env.PREVIEWJS_LOADER_INSTALL_DIR!;
if (!loaderInstallDir) {
  throw new Error(`Missing environment variable: PREVIEWJS_LOADER_INSTALL_DIR`);
}

const loaderWorkerPath = process.env.PREVIEWJS_LOADER_WORKER_PATH!;
if (!loaderWorkerPath) {
  throw new Error(`Missing environment variable: PREVIEWJS_LOADER_WORKER_PATH`);
}

const versionCode = process.env.PREVIEWJS_VERSION_CODE!;
if (!versionCode) {
  throw new Error(`Missing environment variable: PREVIEWJS_VERSION_CODE`);
}

startDaemon({
  loaderInstallDir,
  loaderWorkerPath,
  onServerStartModuleName,
  versionCode,
  port,
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

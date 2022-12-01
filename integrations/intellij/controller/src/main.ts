import { startServer } from "@previewjs/server";

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

startServer({
  loaderInstallDir: __dirname,
  packageName,
  versionCode: `intellij-${version}`,
  port,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

import { startDaemon } from "@previewjs/daemon";
import { readFileSync } from "fs";

const { version } = JSON.parse(
  readFileSync(`${__dirname}/../package.json`, "utf8")
);

const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
if (!packageName) {
  throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
}

const port = parseInt(process.env.PREVIEWJS_PORT || "0");
if (!port) {
  throw new Error(`Missing environment variable: PREVIEWJS_PORT`);
}

startDaemon({
  loaderInstallDir: process.env.PREVIEWJS_MODULES_DIR || __dirname,
  packageName,
  versionCode: `vscode-${version}`,
  port,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

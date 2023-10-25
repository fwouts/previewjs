import { startDaemon } from "@previewjs/daemon";
import { readFileSync } from "fs";
import { join } from "path";

const { version } = JSON.parse(
  readFileSync(`${__dirname}/../package.json`, "utf8")
);

const onServerStartModuleName = process.env.PREVIEWJS_PACKAGE_NAME;
if (!onServerStartModuleName) {
  throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
}

const port = parseInt(process.env.PREVIEWJS_PORT || "0");
if (!port) {
  throw new Error(`Missing environment variable: PREVIEWJS_PORT`);
}

startDaemon({
  loaderInstallDir: process.env.PREVIEWJS_MODULES_DIR || __dirname,
  loaderWorkerPath: join(__dirname, "worker.js"),
  onServerStartModuleName,
  versionCode: `vscode-${version}`,
  port,
}).catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

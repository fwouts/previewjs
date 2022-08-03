import { ensureServerRunning } from "@previewjs/server";
import { readFileSync } from "fs";
import { getLoaderInstallDir } from "./loader-install-dir";

const port = parseInt(process.env.PORT || "0");
if (!port) {
  throw new Error(`Missing environment variable: PORT`);
}

const { version } = JSON.parse(
  readFileSync(`${__dirname}/../package.json`, "utf8")
);

const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
if (!packageName) {
  throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
}

ensureServerRunning({
  loaderInstallDir: getLoaderInstallDir(),
  packageName,
  versionCode: `vscode-${version}`,
  port,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

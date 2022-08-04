import { ensureServerRunning } from "@previewjs/server";
import { readFileSync } from "fs";
import { getLoaderInstallDir } from "./loader-install-dir";
import { SERVER_PORT } from "./port";

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
  port: SERVER_PORT,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

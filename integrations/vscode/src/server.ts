import { runServer } from "@previewjs/server";
import { readFileSync } from "fs";
import { getLoaderInstallDir } from "./loader-install-dir";

// TODO: Dynamic? Same as IntelliJ? Figure it out.
const port = parseInt(process.env.PORT || "9200");
const { version } = JSON.parse(
  readFileSync(`${__dirname}/../package.json`, "utf8")
);

const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
if (!packageName) {
  throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
}

runServer({
  loaderInstallDir: getLoaderInstallDir(),
  packageName,
  versionCode: `vscode-${version}`,
  port,
}).catch((e) => {
  console.error(e);
  process.exit(1);
});

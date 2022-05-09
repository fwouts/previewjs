import path from "path";

export function getPackageNameFromEnvironment() {
  const packageName = process.env.PREVIEWJS_PACKAGE_NAME;
  if (!packageName) {
    throw new Error(`Missing environment variable: PREVIEWJS_PACKAGE_NAME`);
  }
  return packageName;
}

export function getInstallDir() {
  return path.join(__dirname, "..", "dependencies");
}

import path from "path";

export function getLoaderInstallDir() {
  return (
    process.env.PREVIEWJS_MODULES_DIR ||
    path.join(__dirname, "..", "dependencies")
  );
}

export function getLoaderInstallDir() {
  return process.env.PREVIEWJS_MODULES_DIR || __dirname;
}

import path from "path";

export function inferComponentNameFromVuePath(filePath: string) {
  return path.basename(filePath, path.extname(filePath));
}

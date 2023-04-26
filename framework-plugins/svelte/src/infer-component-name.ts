import path from "path";

export function inferComponentNameFromSveltePath(filePath: string) {
  return path.basename(filePath, path.extname(filePath));
}

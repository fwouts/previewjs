export function toVitePath(absoluteFilePath: string) {
  if (absoluteFilePath.match(/^[a-z]:/)) {
    // Vite uses uppercase drive letters on Windows.
    absoluteFilePath =
      absoluteFilePath[0]?.toUpperCase() + absoluteFilePath.substring(1);
  }
  // Vite uses forward slash even on Windows.
  return absoluteFilePath.replace(/\\/g, "/");
}

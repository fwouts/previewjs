export function generatePreviewableId(options: {
  filePath: string;
  name: string;
}) {
  return `${options.filePath.replace(/\\/g, "/")}:${options.name}`;
}

export function decodePreviewableId(id: string): {
  filePath: string;
  name: string;
} {
  const colonPosition = id.lastIndexOf(":");
  if (colonPosition === -1) {
    throw new Error(`Invalid previewable ID: "${id}"`);
  }
  const [filePath, componentName] = id.split(":") as [string, string];
  return {
    filePath,
    name: componentName,
  };
}

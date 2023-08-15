export function generatePreviewableId(options: {
  filePath: string;
  name: string;
}) {
  return `${options.filePath.replace(/\\/g, "/")}:${options.name}`;
}

export function decodePreviewableId(previewableId: string): {
  filePath: string;
  name: string;
} {
  const colonPosition = previewableId.lastIndexOf(":");
  if (colonPosition === -1) {
    throw new Error(`Invalid component ID: "${previewableId}"`);
  }
  const [filePath, componentName] = previewableId.split(":") as [
    string,
    string,
  ];
  return {
    filePath,
    name: componentName,
  };
}

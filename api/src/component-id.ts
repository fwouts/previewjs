export function generateComponentId(options: {
  filePath: string;
  name: string;
}) {
  return `${options.filePath.replace(/\\/g, "/")}:${options.name}`;
}

export function decodeComponentId(componentId: string): {
  filePath: string;
  name: string;
} {
  const colonPosition = componentId.lastIndexOf(":");
  if (colonPosition === -1) {
    throw new Error(`Invalid component ID: "${componentId}"`);
  }
  const [filePath, componentName] = componentId.split(":") as [string, string];
  return {
    filePath,
    name: componentName,
  };
}

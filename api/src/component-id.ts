export function generateComponentId(options: {
  filePath: string;
  name: string;
}) {
  return `${options.filePath.replace(/\\/g, "/")}:${options.name}`;
}

export function generateComponentId(options: {
  currentFilePath: string,
  siblingFileName?: string,
  name: string,
}) {
  return `${options.currentFilePath.replace(/\\/g, "/")}:${
    options.siblingFileName ? `${options.siblingFileName}/` : ""
  }${options.name}`;
}

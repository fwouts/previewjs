export function decodeComponentId(componentId: string): {
  currentFilePath: string;
  component: {
    filePath: string;
    name: string;
  } | null;
} {
  const colonPosition = componentId.lastIndexOf(":");
  if (colonPosition === -1) {
    return {
      currentFilePath: componentId,
      component: null,
    };
  }
  const currentFilePath = componentId.slice(0, colonPosition);
  const componentKey = componentId.slice(colonPosition + 1);
  const slashPosition = componentKey.lastIndexOf("/");
  if (slashPosition === -1) {
    return {
      currentFilePath,
      component: {
        filePath: currentFilePath,
        name: componentKey,
      },
    };
  }
  const dirPath = currentFilePath.slice(0, currentFilePath.lastIndexOf("/"));
  const siblingFileName = componentKey.slice(0, slashPosition);
  const componentName = componentKey.slice(slashPosition + 1);
  return {
    currentFilePath,
    component: {
      filePath: `${dirPath}/${siblingFileName}`,
      name: componentName,
    },
  };
}

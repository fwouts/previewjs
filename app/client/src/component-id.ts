export function currentFilePathFromComponentId(componentId: string) {
  return beforeLast(":", componentId) || componentId;
}

export function actualFilePathFromComponentId(componentId: string) {
  const componentKey = afterLast(":", componentId);
  if (!componentKey) {
    return null;
  }
  const currentFilePath = currentFilePathFromComponentId(componentId);
  const siblingFileName = beforeLast("/", componentKey);
  if (!siblingFileName) {
    return currentFilePath;
  }
  return beforeLast("/", currentFilePath) + "/" + siblingFileName;
}

export function componentNameFromComponentId(componentId: string) {
  const componentKey = afterLast(":", componentId);
  if (!componentKey) {
    return null;
  }
  return afterLast("/", componentKey) || componentKey;
}

function beforeLast(separator: string, str: string) {
  const colonPosition = str.lastIndexOf(separator);
  if (colonPosition === -1) {
    return null;
  } else {
    return str.slice(0, colonPosition);
  }
}

function afterLast(separator: string, str: string) {
  const colonPosition = str.lastIndexOf(separator);
  if (colonPosition === -1) {
    return null;
  } else {
    return str.slice(colonPosition + 1);
  }
}

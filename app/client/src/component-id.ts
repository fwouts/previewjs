export function filePathFromComponentId(componentId: string) {
  const colonPosition = componentId.lastIndexOf(":");
  if (colonPosition === -1) {
    return componentId;
  } else {
    return componentId.slice(0, colonPosition);
  }
}

export function componentNameFromComponentId(componentId: string) {
  const colonPosition = componentId.lastIndexOf(":");
  if (colonPosition === -1) {
    return null;
  } else {
    return componentId.slice(colonPosition + 1);
  }
}

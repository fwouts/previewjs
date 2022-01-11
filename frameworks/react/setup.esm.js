export function setupPreviews(Component, previewProps) {
  if (!process.env.RUNNING_INSIDE_PREVIEWJS) {
    return;
  }
  if (typeof previewProps === "function") {
    previewProps = previewProps();
  }
  Component.__previewjs_variants = [];
  for (const [key, props] of Object.entries(previewProps)) {
    Component.__previewjs_variants.push({
      key,
      label: key,
      props,
    });
  }
}

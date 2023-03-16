export async function componentLoader(
  filePath,
  componentName,
  autogenCallbackPropsSource,
  propsAssignmentSource
) {
  const componentLoaderUrl = `/preview/@component-loader.js?p=${encodeURIComponent(
    filePath
  )}&c=${encodeURIComponent(componentName)}&a=${encodeURIComponent(
    autogenCallbackPropsSource
  )}&s=${encodeURIComponent(propsAssignmentSource)}`;
  return await import(/* @vite-ignore */ componentLoaderUrl);
}

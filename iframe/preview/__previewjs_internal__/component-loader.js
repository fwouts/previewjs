export async function componentLoader(filePath, componentName) {
  const componentLoaderUrl = `/preview/@component-loader.js?p=${encodeURIComponent(
    filePath
  )}&c=${encodeURIComponent(componentName)}`;
  return await import(/* @vite-ignore */ componentLoaderUrl);
}

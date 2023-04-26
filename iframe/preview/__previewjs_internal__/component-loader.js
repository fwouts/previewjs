export async function componentLoader(componentId) {
  const componentLoaderUrl = `/preview/@component-loader.js?c=${encodeURIComponent(
    componentId
  )}`;
  return await import(/* @vite-ignore */ componentLoaderUrl);
}

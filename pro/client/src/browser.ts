declare global {
  interface Window {
    // Exposed in IntelliJ plugin.
    openInExternalBrowser?(url: string): void;
  }
}

export function openUrl(url: string) {
  if (window.openInExternalBrowser) {
    window.openInExternalBrowser(url);
    return;
  }
  if (!navigator.userAgent.includes(" Code/")) {
    // We're not running in VS Code.
    window.open(url, "_blank");
    return;
  }
  window.parent.postMessage(
    {
      command: "open-browser",
      url,
    },
    "*"
  );
}

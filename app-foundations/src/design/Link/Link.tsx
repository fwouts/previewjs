import React, { useCallback } from "react";

declare global {
  interface Window {
    // Exposed in IntelliJ plugin.
    openInExternalBrowser?(url: string): void;
  }
}

export const Link = (props: React.ComponentProps<"a">) => {
  const onClick = useCallback(
    (event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
      if (props.href) {
        openUrl(props.href);
        event.preventDefault();
      }
      return props.onClick && props.onClick(event);
    },
    [props]
  );
  return <a {...props} onClick={onClick} />;
};

export function openUrl(url: string) {
  if (window.openInExternalBrowser) {
    window.openInExternalBrowser(url);
    return;
  }
  if (navigator.userAgent.includes(" Code/")) {
    window.parent.postMessage(
      {
        command: "open-browser",
        url,
      },
      "*"
    );
    return;
  }
  // We must be running in a browser.
  window.open(url, "_blank");
}

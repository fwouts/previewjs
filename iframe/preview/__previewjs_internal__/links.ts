export function setUpLinkInterception() {
  document.addEventListener(
    "click",
    (event) => {
      let node = event && event.target;
      while (node) {
        if (!(node instanceof Node)) {
          break;
        }
        if (node.nodeName === "A") {
          const url = (node as any).href;
          // Handle click here by posting data back to VS Code
          // for your extension to handle
          if (url) {
            window.__PREVIEWJS_IFRAME__.reportEvent({
              kind: "action",
              type: "url",
              path: url,
            });
          }
          event.preventDefault();
          return;
        }
        node = node.parentNode;
      }
    },
    true
  );
}

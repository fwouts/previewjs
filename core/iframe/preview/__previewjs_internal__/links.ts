import { sendMessageFromPreview } from "./messages";

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
            sendMessageFromPreview({
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

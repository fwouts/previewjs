import vscode from "vscode";
import { ensurePreviewServerStopped } from "./preview-server";
import { PreviewJsState } from "./state";

export function updatePreviewPanel(
  state: PreviewJsState,
  previewBaseUrl: string,
  componentId: string
) {
  if (!state.previewPanel) {
    state.previewPanel = vscode.window.createWebviewPanel(
      "preview", // Identifies the type of the webview. Used internally
      "Preview", // Title of the panel displayed to the user
      vscode.ViewColumn.Two, // Editor column to show the new webview panel in.
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );
    state.previewPanel.webview.onDidReceiveMessage((message) => {
      if (message.command === "open-browser") {
        vscode.env.openExternal(vscode.Uri.parse(message.url));
      }
    });
    state.previewPanel.onDidDispose(() => {
      state.previewPanel = null;
      ensurePreviewServerStopped(state).catch(console.error);
    });
    state.previewPanel.webview.html = `<!DOCTYPE html>
  <html>
    <head>
      <style>
        body {
          background: white;
          margin: 0;
          padding: 0;
          width: 100vw;
          height: 100vh;
          overflow: hidden;
        }

        iframe {
          border: none;
          width: 100%;
          height: 100%;
        }
      </style>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta http-equiv="Content-Security-Policy" content="default-src http://localhost:*; script-src 'unsafe-inline'">
      <script>
        const vscode = acquireVsCodeApi();
        let iframe;
        window.addEventListener("load", () => {
          iframe = document.getElementById('preview-iframe');
          iframe.src = "${previewBaseUrl}?p=${encodeURIComponent(componentId)}";
        });
        window.addEventListener("message", (event) => {
          const data = event.data;
          if (data && data.kind === 'navigate') {
            if (iframe.src.startsWith(data.previewBaseUrl)) {
              iframe.contentWindow.postMessage(data, data.previewBaseUrl);
            } else {
              iframe.src = \`\${data.previewBaseUrl}?p=\${encodeURIComponent(data.componentId)}\`;
            }
          } else {
            // Other messages come from the preview iframe.
            vscode.postMessage(data);
          }
        });
      </script>
    </head>
    <body>
      <iframe id="preview-iframe"></iframe>
    </body>
  </html>`;
  } else {
    state.previewPanel.webview.postMessage({
      kind: "navigate",
      previewBaseUrl,
      componentId,
    });
  }
  state.previewPanel.reveal(vscode.ViewColumn.Beside, true);
}

export function closePreviewPanel(state: PreviewJsState) {
  if (state.previewPanel) {
    state.previewPanel.dispose();
    state.previewPanel = null;
  }
}

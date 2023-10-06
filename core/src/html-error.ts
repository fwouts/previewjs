import { escape } from "html-escaper";

export function generateHtmlError(message: string) {
  if (message.startsWith("Error: Build failed with 1 error:\n")) {
    message = message.substring(message.indexOf("\n") + 1);
  }
  return `<html>
  <head>
    <meta http-equiv="refresh" content="3">
    <style>
      body {
        font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
        monospace;
        white-space: pre-wrap;
        background: #FCA5A5;
        color: #7F1D1D;
        margin: 8px;
        font-size: 12px;
        line-height: 1.5em;
      }
    </style>
  </head>
  <body>${escape(message.trim())}</body>
</html>`;
}

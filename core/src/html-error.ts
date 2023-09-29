import { escape } from "html-escaper";

export function generateHtmlError(message: string) {
  return `<html>
  <head>
    <style>
      body {
        background: #FCA5A5
      }
      pre {
        font-family: source-code-pro, Menlo, Monaco, Consolas, 'Courier New',
        monospace;
        font-size: 12px;
        line-height: 1.5em;
        color: #7F1D1D;
      }
    </style>
  </head>
  <body>
    <pre>${escape(message)}</pre>
  </body>
</html>`;
}

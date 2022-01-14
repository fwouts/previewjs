package com.previewjs.intellij.plugin.services

import com.intellij.ui.jcef.JBCefJSQuery

fun generateDefaultPreviewHtml(linkHandler: JBCefJSQuery): String {
    return """
<!DOCTYPE html>
<html>
  <head>
    <style>
      * {
        margin: 0;
        padding: 0;
        font-size: 1rem;
      }

      body {
        margin: 1rem;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto",
          "Oxygen", "Ubuntu", "Cantarell", "Fira Sans", "Droid Sans",
          "Helvetica Neue", sans-serif;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
      }

      h1 {
        font-weight: 600;
        margin: 0.5rem;
      }

      p {
        margin: 0.5rem;
      }

      a {
        color: hsl(213, 80%, 50%);
        text-decoration: none;
        cursor: pointer;
      }
    </style>
    <script>
        function openInExternalBrowser(link) {
            ${linkHandler.inject("link")}
        }
    </script>
  </head>
  <body>
    <h1>Welcome to Preview.js!</h1>
    <p>
      <a onClick="openInExternalBrowser('https://previewjs.com/docs')">See Preview.js documentation</a>
      for usage instructions.
    </p>
  </body>
</html>
            """
}

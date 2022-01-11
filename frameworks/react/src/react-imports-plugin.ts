import path from "path";
import type { Plugin } from "vite";

// Since React 17, importing React is optional when building with webpack.
// We do need the import with Vite, however.
const reactImportRegExp = /import (\* as )?React[ ,]/;
const extensions = new Set([".js", ".jsx", ".tsx"]);

export function reactImportsPlugin(): Plugin {
  return {
    name: "previewjs:react-imports",
    async transform(code, id) {
      const ext = path.extname(id);
      if (
        id.includes("node_modules") ||
        (ext && !extensions.has(ext)) ||
        reactImportRegExp.test(code)
      ) {
        return code;
      }
      return `import React from 'react';${code}`;
    },
  };
}

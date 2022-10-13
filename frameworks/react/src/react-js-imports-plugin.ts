import path from "path";
import type { Plugin } from "vite";

// Since React 17, importing React is optional.
// @vitejs/plugin-react adds the import automatically for .jsx/tsx files
// but not .js files.
const reactImportRegExp = /import (\* as )?React[ ,]/;

export function reactImportsPlugin(): Plugin {
  return {
    name: "previewjs:react-js-imports",
    async transform(code, id) {
      if (
        id.includes("node_modules") ||
        path.extname(id) !== ".js" ||
        reactImportRegExp.test(code)
      ) {
        return code;
      }
      return `import React from 'react';${code}`;
    },
  };
}

import path from "path";
import * as vite from "vite";

const extensions = new Set([".js", ".jsx", ".ts", ".tsx"]);
const importRegexp =
  /import\s+([\S]+)\s+from\s+('|")([\S]+)\.(css|less|sass|scss|styl|stylus|postcss)(\?[\S]*)?&?('|")/g;

/**
 * Allows imports of CSS modules without a .module.css suffix.
 *
 * See https://github.com/zenclabs/previewjs/discussions/39
 */
export function cssModulesWithoutSuffixPlugin(): vite.Plugin {
  return {
    name: "previewjs:css-modules-without-suffix",
    async transform(code, id) {
      // Ignore query parameters.
      id = id.split("?")[0]!;
      if (!extensions.has(path.extname(id))) {
        return;
      }
      return code.replace(
        importRegexp,
        'import $1 from "$3.$4?$5&.module.css"'
      );
    },
  };
}

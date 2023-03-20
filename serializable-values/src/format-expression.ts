import prettier from "prettier";
import parserBabel from "prettier/parser-babel.js";

export function formatExpression(expressionSource: string) {
  const formattedStatement = prettier
    .format(`value = ${expressionSource}`, {
      parser: "babel",
      plugins: [parserBabel],
      filepath: "component.js",
      trailingComma: "none",
    })
    .trim();
  return formattedStatement.replace(/^value = ((.|\s)*);$/m, "$1");
}

import prettier from "prettier";
import parserBabel from "prettier/parser-babel.js";

export function formatExpression(expressionSource: string) {
  try {
    const formattedStatement = prettier
      .format(`value = ${expressionSource}`, {
        parser: "babel",
        plugins: [parserBabel],
        filepath: "component.js",
        trailingComma: "none",
      })
      .trim();
    return formattedStatement.replace(/^value = ((.|\s)*);$/m, "$1");
  } catch {
    // This can be expected e.g. when code is in the middle of being typed.
    // Example: Promise.reject(new|)
    return expressionSource;
  }
}

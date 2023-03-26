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
    if (formattedStatement.startsWith("value = (\n")) {
      // In the case of JSX, it gets formatted as "value = (<div>...</div>);".
      // This is the same regex as below, but with the extra parens.
      return formattedStatement.replace(/^value = \(((.|\s)*)\);$/m, "$1");
    }
    return formattedStatement.replace(/^value = ((.|\s)*);$/m, "$1");
  } catch {
    // This can be expected e.g. when code is in the middle of being typed.
    // Example: Promise.reject(new|)
    return expressionSource;
  }
}

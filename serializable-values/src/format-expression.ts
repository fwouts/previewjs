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
      return stripFormattedIndent(
        formattedStatement.replace(/^value = \(((.|\s)*)\);$/m, "$1")
      );
    }
    return stripFormattedIndent(
      formattedStatement.replace(/^value = ((.|\s)*);$/m, "$1")
    );
  } catch {
    // This can be expected e.g. when code is in the middle of being typed.
    // Example: Promise.reject(new|)
    return expressionSource;
  }
}

function stripFormattedIndent(source: string) {
  const lines = source.split("\n");
  if (lines.length <= 1) {
    return source.trim();
  }
  const firstLine = lines[0]?.trim() ? lines[0] : lines[1];
  const firstLineIndentMatch = firstLine?.match(/^( +)/);
  if (!firstLineIndentMatch) {
    return source.trim();
  }
  const indent = firstLineIndentMatch[1]?.length || 0;
  return lines
    .map((line) => {
      const beginning = line.substring(0, indent);
      if (beginning.trim().length) {
        // This line is not indented (is that even possible?). Return it as is.
        return line;
      }
      return line.substring(indent);
    })
    .join("\n")
    .trim();
}

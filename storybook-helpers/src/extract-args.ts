import {
  parseSerializableValue,
  SerializableValue,
} from "@previewjs/serializable-values";
import ts from "typescript";

export function extractArgs(
  sourceFile: ts.SourceFile
): Record<string, () => StoryArgs> {
  const args: ReturnType<typeof extractArgs> = {};
  for (const statement of sourceFile.statements) {
    if (
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(statement.expression.left) &&
      ts.isIdentifier(statement.expression.left.expression)
    ) {
      const name = statement.expression.left.expression.text;
      // We're looking specifically for assignments such as Button.args = {...}.
      // We can make each such prop optional in the component, since it already has a value.
      // See https://storybook.js.org/docs/react/writing-stories/args
      if (statement.expression.left.name.text === "args") {
        const argsNode = statement.expression.right;
        args[name] = () => {
          return {
            start: argsNode.getStart(),
            end: argsNode.getEnd(),
            value: parseSerializableValue(argsNode),
          };
        };
      }
    }
  }
  return args;
}

export type StoryArgs = {
  start: number;
  end: number;
  value: SerializableValue;
};

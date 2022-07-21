import ts from "typescript";
import {
  array,
  EMPTY_MAP,
  EMPTY_SET,
  FALSE,
  fn,
  map,
  NULL,
  number,
  object,
  promise,
  SerializableObjectValueEntry,
  SerializableValue,
  set,
  string,
  TRUE,
  UNDEFINED,
  unknown,
} from "./serializable-value";

export function parseSerializableValue(
  expression: ts.Expression
): SerializableValue {
  const fallbackValue = unknown(expression.getText());

  // (...)
  if (ts.isParenthesizedExpression(expression)) {
    return parseSerializableValue(expression.expression);
  }

  // null
  if (expression.kind === ts.SyntaxKind.NullKeyword) {
    return NULL;
  }

  // true
  if (expression.kind === ts.SyntaxKind.TrueKeyword) {
    return TRUE;
  }

  // false
  if (expression.kind === ts.SyntaxKind.FalseKeyword) {
    return FALSE;
  }

  // undefined
  if (
    expression.kind === ts.SyntaxKind.UndefinedKeyword ||
    (ts.isIdentifier(expression) && expression.text === "undefined")
  ) {
    return UNDEFINED;
  }

  // 123
  if (ts.isNumericLiteral(expression)) {
    try {
      return number(parseFloat(expression.text));
    } catch {
      return fallbackValue;
    }
  }

  // -123
  if (
    ts.isPrefixUnaryExpression(expression) &&
    expression.operator === ts.SyntaxKind.MinusToken &&
    ts.isNumericLiteral(expression.operand)
  ) {
    try {
      return number(-parseFloat(expression.operand.text));
    } catch {
      return fallbackValue;
    }
  }

  // "foo"
  if (ts.isStringLiteral(expression)) {
    return string(expression.text);
  }

  // `foo`
  if (ts.isNoSubstitutionTemplateLiteral(expression)) {
    return string(expression.text);
  }

  // [1, 2, 3]
  if (ts.isArrayLiteralExpression(expression)) {
    return array(expression.elements.map(parseSerializableValue));
  }

  if (
    ts.isNewExpression(expression) &&
    (expression.arguments?.length || 0) <= 1
  ) {
    if (ts.isIdentifier(expression.expression)) {
      // new Set([1, 2, 3])
      if (expression.expression.text === "Set") {
        const firstArgument = expression.arguments && expression.arguments[0];
        if (!firstArgument) {
          return EMPTY_SET;
        } else if (ts.isArrayLiteralExpression(firstArgument)) {
          return set(array(firstArgument.elements.map(parseSerializableValue)));
        }
      }

      // new Map([["foo", "bar"]])
      if (expression.expression.text === "Map") {
        const firstArgument = expression.arguments && expression.arguments[0];
        if (!firstArgument) {
          return EMPTY_MAP;
        } else if (ts.isArrayLiteralExpression(firstArgument)) {
          const entries: SerializableObjectValueEntry[] = [];
          for (const element of firstArgument.elements) {
            if (
              !ts.isArrayLiteralExpression(element) ||
              element.elements.length !== 2
            ) {
              return fallbackValue;
            }
            entries.push({
              key: parseSerializableValue(element.elements[0]!),
              value: parseSerializableValue(element.elements[1]!),
            });
          }
          return map(object(entries));
        } else if (
          ts.isCallExpression(firstArgument) &&
          ts.isPropertyAccessExpression(firstArgument.expression) &&
          ts.isIdentifier(firstArgument.expression.expression) &&
          firstArgument.expression.expression.text === "Object" &&
          firstArgument.expression.name.text === "entries" &&
          firstArgument.arguments.length === 1
        ) {
          const object = parseSerializableValue(firstArgument.arguments[0]!);
          if (object.kind !== "object") {
            return fallbackValue;
          }
          return map(object);
        }
      }
    }
  }

  // Promise.resolve(...)
  // Promise.reject(...)
  if (
    ts.isCallExpression(expression) &&
    ts.isPropertyAccessExpression(expression.expression) &&
    ts.isIdentifier(expression.expression.expression) &&
    expression.expression.expression.text === "Promise" &&
    ts.isIdentifier(expression.expression.name) &&
    expression.arguments.length <= 1
  ) {
    const firstArgument = expression.arguments[0];
    if (expression.expression.name.text === "resolve") {
      const value = firstArgument
        ? parseSerializableValue(firstArgument)
        : UNDEFINED;
      return promise({
        type: "resolve",
        value,
      });
    }
    if (expression.expression.name.text === "reject") {
      if (!firstArgument) {
        return promise({
          type: "reject",
          message: null,
        });
      } else if (
        ts.isNewExpression(firstArgument) &&
        (firstArgument.arguments?.length || 0) <= 1
      ) {
        const firstErrorArgument =
          firstArgument.arguments && firstArgument.arguments[0];
        if (firstErrorArgument) {
          if (
            ts.isStringLiteral(firstErrorArgument) ||
            ts.isNoSubstitutionTemplateLiteral(firstErrorArgument)
          ) {
            return promise({
              type: "reject",
              message: firstErrorArgument.text,
            });
          }
        }
      }
    }
  }

  // { foo: "bar" }
  if (ts.isObjectLiteralExpression(expression)) {
    const entries: SerializableObjectValueEntry[] = [];
    for (const property of expression.properties) {
      if (!ts.isPropertyAssignment(property)) {
        return fallbackValue;
      }
      if (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) {
        entries.push({
          key: string(property.name.text),
          value: parseSerializableValue(property.initializer),
        });
      } else {
        return fallbackValue;
      }
    }
    return object(entries);
  }

  // () => 123
  if (ts.isArrowFunction(expression) && expression.parameters.length === 0) {
    if (ts.isBlock(expression.body)) {
      const statements = expression.body.statements;
      if (statements.length === 0) {
        return fn(UNDEFINED);
      } else if (statements.length === 1) {
        const returnStatement = statements[0]!;
        if (!ts.isReturnStatement(returnStatement)) {
          return fallbackValue;
        }
        return fn(
          returnStatement.expression
            ? parseSerializableValue(returnStatement.expression)
            : UNDEFINED
        );
      } else {
        return fallbackValue;
      }
    } else {
      return fn(parseSerializableValue(expression.body));
    }
  }

  // function() { return 123 }
  if (
    ts.isFunctionExpression(expression) &&
    expression.parameters.length === 0
  ) {
    const statements = expression.body.statements;
    if (statements.length === 0) {
      return fn(UNDEFINED);
    } else if (statements.length === 1) {
      const returnStatement = statements[0]!;
      if (!ts.isReturnStatement(returnStatement)) {
        return fallbackValue;
      }
      return fn(
        returnStatement.expression
          ? parseSerializableValue(returnStatement.expression)
          : UNDEFINED
      );
    } else {
      return fallbackValue;
    }
  }

  return fallbackValue;
}

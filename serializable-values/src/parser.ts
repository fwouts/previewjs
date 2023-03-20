import assertNever from "assert-never";
import ts from "typescript";
import { formatExpression } from "./format-expression";
import type {
  SerializableObjectValueEntry,
  SerializableValue,
} from "./serializable-value";
import {
  EMPTY_MAP,
  EMPTY_SET,
  FALSE,
  NULL,
  TRUE,
  UNDEFINED,
  UNKNOWN,
  array,
  fn,
  map,
  number,
  object,
  promise,
  set,
  string,
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
              kind: "key",
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
      property;
      if (ts.isShorthandPropertyAssignment(property)) {
        entries.push({
          kind: "key",
          key: string(property.name.text),
          value: UNKNOWN,
        });
      } else if (ts.isPropertyAssignment(property)) {
        const key = extractKeyFromPropertyName(property.name);
        if (key.kind === "unknown") {
          return fallbackValue;
        }
        entries.push({
          kind: "key",
          key,
          value: parseSerializableValue(property.initializer),
        });
      } else if (ts.isSpreadAssignment(property)) {
        entries.push({
          kind: "spread",
          value: property.name
            ? // TODO: Property access off property.expression.
              UNKNOWN
            : parseSerializableValue(property.expression),
        });
      } else if (ts.isFunctionLike(property)) {
        // TODO: Handle this better, e.g. { foo() { ... } }
        return fallbackValue;
      } else {
        throw assertNever(property);
      }
    }
    return object(entries);
  }

  // arrow function: () => 123
  // function expression: function() { return 123 }
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    return fn(formatExpression(expression.getText()));
  }

  return fallbackValue;
}

function extractKeyFromPropertyName(
  propertyName: ts.PropertyName
): SerializableValue {
  if (
    ts.isIdentifier(propertyName) ||
    ts.isStringLiteral(propertyName) ||
    ts.isNumericLiteral(propertyName)
  ) {
    return string(propertyName.text);
  } else if (ts.isComputedPropertyName(propertyName)) {
    return parseSerializableValue(propertyName.expression);
  }
  return UNKNOWN;
}

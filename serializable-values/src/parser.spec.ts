import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parseSerializableValue } from "./parser";
import {
  array,
  EMPTY_ARRAY,
  EMPTY_MAP,
  EMPTY_OBJECT,
  EMPTY_SET,
  FALSE,
  fn,
  map,
  NULL,
  number,
  object,
  promise,
  SerializableValue,
  set,
  string,
  TRUE,
  UNDEFINED,
  unknown,
} from "./serializable-value";
import { serializableValueToJavaScript } from "./serializable-value-to-js";

describe("parseSerializableValue", () => {
  it("parses null", () => {
    expectParsedExpression(`null`).toEqual<SerializableValue>(NULL);
  });

  it("parses parenthesized expression", () => {
    expectParsedExpression(`(null)`).toEqual<SerializableValue>(NULL);
  });

  it("parses arrays", () => {
    expectParsedExpression(`[]`).toEqual(EMPTY_ARRAY);
    expectParsedExpression(`["foo", 123]`).toEqual(
      array([string("foo"), number(123)])
    );
  });

  it("parses booleans", () => {
    expectParsedExpression("true").toEqual(TRUE);
    expectParsedExpression("false").toEqual(FALSE);
  });

  it("parses arrow expression functions", () => {
    expectParsedExpression(`() => 123`).toEqual(fn(number(123)));
    checkParsedExpressionIsUnknownWithSource(`(a) => a`);
  });

  it("parses arrow block functions", () => {
    expectParsedExpression(`() => {
      return;
    }`).toEqual(fn(UNDEFINED));
    expectParsedExpression(`() => {
      return 123;
    }`).toEqual(fn(number(123)));
    checkParsedExpressionIsUnknownWithSource(`() => {
  console.log("foo");
  return 123;
}`);
    checkParsedExpressionIsUnknownWithSource(`(a) => {
  console.log("foo");
  if (a) {
    return 123;
  } else {
    return 456;
  }
}`);
    checkParsedExpressionIsUnknownWithSource(`(a) => {
  return a;
}`);
    checkParsedExpressionIsUnknownWithSource(`() => {
  console.log("foo");
}`);
  });

  it("parses classic functions", () => {
    expectParsedExpression(`function () {
      return;
    }`).toEqual(fn(UNDEFINED));
    expectParsedExpression(`function () {
      return 123;
    }`).toEqual(fn(number(123)));
    checkParsedExpressionIsUnknownWithSource(`function () {
  console.log("foo");
  return 123;
}`);
    checkParsedExpressionIsUnknownWithSource(`function (a) {
  return a;
}`);
    checkParsedExpressionIsUnknownWithSource(`function () {
  console.log("foo");
}`);
  });

  it("parses maps", () => {
    expectParsedExpression(`new Map()`).toEqual(EMPTY_MAP);
    expectParsedExpression(`new Map([["foo", "bar"]])`).toEqual(
      map(
        object([
          {
            key: string("foo"),
            value: string("bar"),
          },
        ])
      )
    );
    expectParsedExpression(`new Map(Object.entries({ foo: "bar" }))`).toEqual(
      map(
        object([
          {
            key: string("foo"),
            value: string("bar"),
          },
        ])
      )
    );
  });

  it("parses numbers", () => {
    expectParsedExpression(`123`).toEqual(number(123));
    expectParsedExpression(`-5.3`).toEqual(number(-5.3));
  });

  it("parses objects", () => {
    expectParsedExpression(`{}`).toEqual(EMPTY_OBJECT);
    expectParsedExpression(`{ "foo": "bar" }`).toEqual(
      object([
        {
          key: string("foo"),
          value: string("bar"),
        },
      ])
    );
    expectParsedExpression(`{ foo: "bar" }`).toEqual(
      object([
        {
          key: string("foo"),
          value: string("bar"),
        },
      ])
    );
    checkParsedExpressionIsUnknownWithSource(`{ foo }`);
    checkParsedExpressionIsUnknownWithSource(`{ ...foo }`);
  });

  it("parses promises", () => {
    expectParsedExpression(`Promise.resolve()`).toEqual(
      promise({
        type: "resolve",
        value: UNDEFINED,
      })
    );
    expectParsedExpression(`Promise.resolve(123)`).toEqual(
      promise({
        type: "resolve",
        value: number(123),
      })
    );
    expectParsedExpression(`Promise.reject(new Error("foo"))`).toEqual(
      promise({
        type: "reject",
        message: "foo",
      })
    );
    checkParsedExpressionIsUnknownWithSource(`Promise.reject("foo")`);
    checkParsedExpressionIsUnknownWithSource(
      `Promise.reject(new UnknownError())`
    );
  });

  it("parses sets", () => {
    expectParsedExpression(`new Set()`).toEqual(EMPTY_SET);
    expectParsedExpression(`new Set([123])`).toEqual(set(array([number(123)])));
  });

  it("parses strings", () => {
    expectParsedExpression(`""`).toEqual(string(""));
    expectParsedExpression(`''`).toEqual(string(""));
    expectParsedExpression("``").toEqual(string(""));
    expectParsedExpression(`"foo"`).toEqual(string("foo"));
    expectParsedExpression(`'foo'`).toEqual(string("foo"));
    expectParsedExpression("`foo`").toEqual(string("foo"));
    expectParsedExpression(`"f'o\\"o"`).toEqual(string("f'o\"o"));
    expectParsedExpression(`'f\\'o"o'`).toEqual(string("f'o\"o"));
    expectParsedExpression("`f'o\"o`").toEqual(string("f'o\"o"));
    checkParsedExpressionIsUnknownWithSource("`foo${foo}`");
  });

  it("parses undefined", () => {
    expectParsedExpression(`undefined`).toEqual(UNDEFINED);
  });
});

function expectParsedExpression(expressionSource: string) {
  const parsedValue = parseSerializableValue(parseExpression(expressionSource));
  expect(parsedValue).toEqual(
    parseSerializableValue(
      parseExpression(serializableValueToJavaScript(parsedValue))
    )
  );
  return expect(parsedValue);
}

function parseExpression(expressionSource: string) {
  const sourceFile = ts.createSourceFile(
    __filename,
    `(${expressionSource})`,
    ts.ScriptTarget.Latest,
    true /* setParentNodes */,
    ts.ScriptKind.TSX
  );
  const statement = sourceFile.statements[0];
  if (!statement) {
    throw new Error(`No statement found in source code`);
  }
  if (!ts.isExpressionStatement(statement)) {
    throw new Error(`Expected expression statement, got ${statement.kind}`);
  }
  return statement.expression;
}

function checkParsedExpressionIsUnknownWithSource(expressionSource: string) {
  expectParsedExpression(expressionSource).toEqual(unknown(expressionSource));
}

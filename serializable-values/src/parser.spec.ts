import { AssertionError } from "assert";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parseSerializableValue } from "./parser.js";
import { serializableValueToJavaScript } from "./serializable-value-to-js.js";
import type { SerializableValue } from "./serializable-value.js";
import {
  EMPTY_ARRAY,
  EMPTY_MAP,
  EMPTY_OBJECT,
  EMPTY_SET,
  FALSE,
  NULL,
  TRUE,
  UNDEFINED,
  UNKNOWN,
  array,
  fn,
  map,
  node,
  number,
  object,
  promise,
  set,
  string,
  unknown,
} from "./serializable-value.js";

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
    expectParsedExpression(`() => 123`).toEqual(fn(`() => 123`));
    expectParsedExpression(`(a) => a`).toEqual(fn(`(a) => a`));
  });

  it("parses arrow block functions", () => {
    expectParsedExpression(`() => {
  return;
}`).toEqual(
      fn(`() => {
  return;
}`)
    );
    expectParsedExpression(`() => {
  return 123;
}`).toEqual(
      fn(`() => {
  return 123;
}`)
    );
    expectParsedExpression(`() => {
  console.log("foo");
  return 123;
}`).toEqual(
      fn(`() => {
  console.log("foo");
  return 123;
}`)
    );
    expectParsedExpression(`(a) => {
  console.log("foo");
  if (a) {
    return 123;
  } else {
    return 456;
  }
}`).toEqual(
      fn(`(a) => {
  console.log("foo");
  if (a) {
    return 123;
  } else {
    return 456;
  }
}`)
    );
    expectParsedExpression(`(a) => {
  return a;
}`).toEqual(
      fn(`(a) => {
  return a;
}`)
    );
    expectParsedExpression(`() => {
  console.log("foo");
}`).toEqual(
      fn(`() => {
  console.log("foo");
}`)
    );
  });

  it("parses classic functions", () => {
    expectParsedExpression(`function () {
  return;
}`).toEqual(
      fn(`function () {
  return;
}`)
    );
    expectParsedExpression(`function () {
  return 123;
}`).toEqual(
      fn(`function () {
  return 123;
}`)
    );
    expectParsedExpression(`function () {
  console.log("foo");
  return 123;
}`).toEqual(
      fn(`function () {
  console.log("foo");
  return 123;
}`)
    );
    expectParsedExpression(`function (a) {
  return a;
}`).toEqual(
      fn(`function (a) {
  return a;
}`)
    );
    expectParsedExpression(`function () {
  console.log("foo");
}`).toEqual(
      fn(`function () {
  console.log("foo");
}`)
    );
  });

  it("parses maps", () => {
    expectParsedExpression(`new Map()`).toEqual(EMPTY_MAP);
    expectParsedExpression(`new Map([["foo", "bar"]])`).toEqual(
      map(
        object([
          {
            kind: "key",
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
            kind: "key",
            key: string("foo"),
            value: string("bar"),
          },
        ])
      )
    );
    expectParsedExpression(`new Map(Object.entries({ 0: "bar" }))`).toEqual(
      map(
        object([
          {
            kind: "key",
            key: string("0"),
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
          kind: "key",
          key: string("foo"),
          value: string("bar"),
        },
      ])
    );
    expectParsedExpression(`{ foo: "bar" }`).toEqual(
      object([
        {
          kind: "key",
          key: string("foo"),
          value: string("bar"),
        },
      ])
    );
    expectParsedExpression(`{ 0: "bar" }`).toEqual(
      object([
        {
          kind: "key",
          key: string("0"),
          value: string("bar"),
        },
      ])
    );
    expectParsedExpression(`{ foo }`, false).toEqual(
      object([
        {
          kind: "key",
          key: string("foo"),
          value: UNKNOWN,
        },
      ])
    );
    expectParsedExpression(`{ ["foo"]: 123 }`, false).toEqual(
      object([
        {
          kind: "key",
          key: string("foo"),
          value: number(123),
        },
      ])
    );
    expectParsedExpression(`{ ...123 }`, false).toEqual(
      object([
        {
          kind: "spread",
          value: number(123),
        },
      ])
    );
    expectParsedExpression(`{ ...foo }`, false).toEqual(
      object([
        {
          kind: "spread",
          value: unknown("foo"),
        },
      ])
    );
    expectParsedExpression(`{ ...foo.args }`, false).toEqual(
      object([
        {
          kind: "spread",
          value: unknown("foo.args"),
        },
      ])
    );
    checkParsedExpressionIsUnknownWithSource(`{ foo() {} }`);
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
    expectParsedExpression(`Promise.reject()`).toEqual(
      promise({
        type: "reject",
        message: null,
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

  it("parses JSX", () => {
    expectParsedExpression(`<></>`).toEqual(node("", EMPTY_OBJECT, []));
    expectParsedExpression(`<><div>foo</div></>`).toEqual(
      node("", EMPTY_OBJECT, [node("div", EMPTY_OBJECT, [string("foo")])])
    );
    expectParsedExpression(`<><div>foo{bar}baz</div></>`).toEqual(
      node("", EMPTY_OBJECT, [
        node("div", EMPTY_OBJECT, [
          string("foo"),
          unknown("bar"),
          string("baz"),
        ]),
      ])
    );
    expectParsedExpression(`<><div>{foo}{" "}{baz}</div></>`).toEqual(
      node("", EMPTY_OBJECT, [
        node("div", EMPTY_OBJECT, [
          unknown("foo"),
          string(" "),
          unknown("baz"),
        ]),
      ])
    );
    expectParsedExpression(`<div></div>`).toEqual(
      node("div", EMPTY_OBJECT, [])
    );
    expectParsedExpression(
      `<div foo bar="str" baz={123} obj={{a: "b"}} {...qux}></div>`
    ).toEqual(
      node(
        "div",
        object([
          {
            kind: "key",
            key: string("foo"),
            value: TRUE,
          },
          {
            kind: "key",
            key: string("bar"),
            value: string("str"),
          },
          {
            kind: "key",
            key: string("baz"),
            value: number(123),
          },
          {
            kind: "key",
            key: string("obj"),
            value: object([
              { kind: "key", key: string("a"), value: string("b") },
            ]),
          },
          {
            kind: "spread",
            value: unknown("qux"),
          },
        ]),
        []
      )
    );
    expectParsedExpression(`<div>hello '"world\\" &lt;</div>`).toEqual(
      node("div", EMPTY_OBJECT, [string(`hello '"world\\" &lt;`)])
    );
  });
});

function expectParsedExpression(expressionSource: string, reversible = true) {
  const parsedValue = parseSerializableValue(parseExpression(expressionSource));
  if (reversible) {
    const regeneratedSource = serializableValueToJavaScript(parsedValue);
    const reparsedValue = parseSerializableValue(
      parseExpression(regeneratedSource)
    );
    try {
      expect(parsedValue).toEqual(reparsedValue);
    } catch {
      throw new AssertionError({
        actual: [regeneratedSource, reparsedValue],
        expected: [expressionSource, parsedValue],
        message: "Expected the same source to be regenerated",
      });
    }
  }
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

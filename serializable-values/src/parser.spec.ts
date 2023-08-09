import { AssertionError } from "assert";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { parseSerializableValue } from "./parser";
import type { SerializableValue } from "./serializable-value";
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
} from "./serializable-value";
import { serializableValueToJavaScript } from "./serializable-value-to-js";

describe("parseSerializableValue", () => {
  it("parses null", async () => {
    (await expectParsedExpression(`null`)).toEqual<SerializableValue>(NULL);
  });

  it("parses parenthesized expression", async () => {
    (await expectParsedExpression(`(null)`)).toEqual<SerializableValue>(NULL);
  });

  it("parses arrays", async () => {
    (await expectParsedExpression(`[]`)).toEqual(EMPTY_ARRAY);
    (await expectParsedExpression(`["foo", 123]`)).toEqual(
      array([string("foo"), number(123)])
    );
  });

  it("parses booleans", async () => {
    (await expectParsedExpression("true")).toEqual(TRUE);
    (await expectParsedExpression("false")).toEqual(FALSE);
  });

  it("parses arrow expression functions", async () => {
    (await expectParsedExpression(`() => 123`)).toEqual(fn(`() => 123`));
    (await expectParsedExpression(`(a) => a`)).toEqual(fn(`(a) => a`));
  });

  it("parses arrow block functions", async () => {
    (
      await expectParsedExpression(`() => {
  return;
}`)
    ).toEqual(
      fn(`() => {
  return;
}`)
    );
    (
      await expectParsedExpression(`() => {
  return 123;
}`)
    ).toEqual(
      fn(`() => {
  return 123;
}`)
    );
    (
      await expectParsedExpression(`() => {
  console.log("foo");
  return 123;
}`)
    ).toEqual(
      fn(`() => {
  console.log("foo");
  return 123;
}`)
    );
    (
      await expectParsedExpression(`(a) => {
  console.log("foo");
  if (a) {
    return 123;
  } else {
    return 456;
  }
}`)
    ).toEqual(
      fn(`(a) => {
  console.log("foo");
  if (a) {
    return 123;
  } else {
    return 456;
  }
}`)
    );
    (
      await expectParsedExpression(`(a) => {
  return a;
}`)
    ).toEqual(
      fn(`(a) => {
  return a;
}`)
    );
    (
      await expectParsedExpression(`() => {
  console.log("foo");
}`)
    ).toEqual(
      fn(`() => {
  console.log("foo");
}`)
    );
  });

  it("parses classic functions", async () => {
    (
      await expectParsedExpression(`function () {
  return;
}`)
    ).toEqual(
      fn(`function () {
  return;
}`)
    );
    (
      await expectParsedExpression(`function () {
  return 123;
}`)
    ).toEqual(
      fn(`function () {
  return 123;
}`)
    );
    (
      await expectParsedExpression(`function () {
  console.log("foo");
  return 123;
}`)
    ).toEqual(
      fn(`function () {
  console.log("foo");
  return 123;
}`)
    );
    (
      await expectParsedExpression(`function (a) {
  return a;
}`)
    ).toEqual(
      fn(`function (a) {
  return a;
}`)
    );
    (
      await expectParsedExpression(`function () {
  console.log("foo");
}`)
    ).toEqual(
      fn(`function () {
  console.log("foo");
}`)
    );
  });

  it("parses maps", async () => {
    (await expectParsedExpression(`new Map()`)).toEqual(EMPTY_MAP);
    (await expectParsedExpression(`new Map([["foo", "bar"]])`)).toEqual(
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
    (
      await expectParsedExpression(`new Map(Object.entries({ foo: "bar" }))`)
    ).toEqual(
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
    (
      await expectParsedExpression(`new Map(Object.entries({ 0: "bar" }))`)
    ).toEqual(
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

  it("parses numbers", async () => {
    (await expectParsedExpression(`123`)).toEqual(number(123));
    (await expectParsedExpression(`-5.3`)).toEqual(number(-5.3));
  });

  it("parses objects", async () => {
    (await expectParsedExpression(`{}`)).toEqual(EMPTY_OBJECT);
    (await expectParsedExpression(`{ "foo": "bar" }`)).toEqual(
      object([
        {
          kind: "key",
          key: string("foo"),
          value: string("bar"),
        },
      ])
    );
    (await expectParsedExpression(`{ foo: "bar" }`)).toEqual(
      object([
        {
          kind: "key",
          key: string("foo"),
          value: string("bar"),
        },
      ])
    );
    (await expectParsedExpression(`{ 0: "bar" }`)).toEqual(
      object([
        {
          kind: "key",
          key: string("0"),
          value: string("bar"),
        },
      ])
    );
    (await expectParsedExpression(`{ foo }`, false)).toEqual(
      object([
        {
          kind: "key",
          key: string("foo"),
          value: UNKNOWN,
        },
      ])
    );
    (await expectParsedExpression(`{ ["foo"]: 123 }`, false)).toEqual(
      object([
        {
          kind: "key",
          key: string("foo"),
          value: number(123),
        },
      ])
    );
    (await expectParsedExpression(`{ ...123 }`, false)).toEqual(
      object([
        {
          kind: "spread",
          value: number(123),
        },
      ])
    );
    (await expectParsedExpression(`{ ...foo }`, false)).toEqual(
      object([
        {
          kind: "spread",
          value: unknown("foo"),
        },
      ])
    );
    (await expectParsedExpression(`{ ...foo.args }`, false)).toEqual(
      object([
        {
          kind: "spread",
          value: unknown("foo.args"),
        },
      ])
    );
    await checkParsedExpressionIsUnknownWithSource(`{ foo() {} }`);
  });

  it("parses promises", async () => {
    (await expectParsedExpression(`Promise.resolve()`)).toEqual(
      promise({
        type: "resolve",
        value: UNDEFINED,
      })
    );
    (await expectParsedExpression(`Promise.resolve(123)`)).toEqual(
      promise({
        type: "resolve",
        value: number(123),
      })
    );
    (await expectParsedExpression(`Promise.reject()`)).toEqual(
      promise({
        type: "reject",
        message: null,
      })
    );
    (await expectParsedExpression(`Promise.reject(new Error("foo"))`)).toEqual(
      promise({
        type: "reject",
        message: "foo",
      })
    );
    await checkParsedExpressionIsUnknownWithSource(`Promise.reject("foo")`);
    await checkParsedExpressionIsUnknownWithSource(
      `Promise.reject(new UnknownError())`
    );
  });

  it("parses sets", async () => {
    (await expectParsedExpression(`new Set()`)).toEqual(EMPTY_SET);
    (await expectParsedExpression(`new Set([123])`)).toEqual(
      set(array([number(123)]))
    );
  });

  it("parses strings", async () => {
    (await expectParsedExpression(`""`)).toEqual(string(""));
    (await expectParsedExpression(`''`)).toEqual(string(""));
    (await expectParsedExpression("``")).toEqual(string(""));
    (await expectParsedExpression(`"foo"`)).toEqual(string("foo"));
    (await expectParsedExpression(`'foo'`)).toEqual(string("foo"));
    (await expectParsedExpression("`foo`")).toEqual(string("foo"));
    (await expectParsedExpression(`"f'o\\"o"`)).toEqual(string("f'o\"o"));
    (await expectParsedExpression(`'f\\'o"o'`)).toEqual(string("f'o\"o"));
    (await expectParsedExpression("`f'o\"o`")).toEqual(string("f'o\"o"));
    await checkParsedExpressionIsUnknownWithSource("`foo${foo}`");
  });

  it("parses undefined", async () => {
    (await expectParsedExpression(`undefined`)).toEqual(UNDEFINED);
  });

  it("parses JSX", async () => {
    (await expectParsedExpression(`<></>`)).toEqual(node("", EMPTY_OBJECT, []));
    (await expectParsedExpression(`<><div>foo</div></>`)).toEqual(
      node("", EMPTY_OBJECT, [node("div", EMPTY_OBJECT, [string("foo")])])
    );
    (await expectParsedExpression(`<><div>foo{bar}baz</div></>`)).toEqual(
      node("", EMPTY_OBJECT, [
        node("div", EMPTY_OBJECT, [
          string("foo"),
          unknown("bar"),
          string("baz"),
        ]),
      ])
    );
    (await expectParsedExpression(`<><div>{foo}{" "}{baz}</div></>`)).toEqual(
      node("", EMPTY_OBJECT, [
        node("div", EMPTY_OBJECT, [
          unknown("foo"),
          string(" "),
          unknown("baz"),
        ]),
      ])
    );
    (await expectParsedExpression(`<div></div>`)).toEqual(
      node("div", EMPTY_OBJECT, [])
    );
    (
      await expectParsedExpression(
        `<div foo bar="str" baz={123} obj={{a: "b"}} {...qux}></div>`
      )
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
    (await expectParsedExpression(`<div>hello '"world\\" &lt;</div>`)).toEqual(
      node("div", EMPTY_OBJECT, [string(`hello '"world\\" &lt;`)])
    );
  });
});

async function expectParsedExpression(
  expressionSource: string,
  reversible = true
) {
  const parsedValue = await parseSerializableValue(
    parseExpression(expressionSource)
  );
  if (reversible) {
    const regeneratedSource = await serializableValueToJavaScript(parsedValue);
    const reparsedValue = await parseSerializableValue(
      parseExpression(regeneratedSource)
    );
    try {
      expect(parsedValue).toEqual(reparsedValue);
    } catch (e) {
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

async function checkParsedExpressionIsUnknownWithSource(
  expressionSource: string
) {
  (await expectParsedExpression(expressionSource)).toEqual(
    unknown(expressionSource)
  );
}

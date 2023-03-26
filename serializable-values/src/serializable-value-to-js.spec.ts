import { describe, expect, test } from "vitest";
import {
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

describe("serializableValueToJavaScript", () => {
  test("array", () => {
    expect(serializableValueToJavaScript(array([]))).toMatchInlineSnapshot(
      '"[]"'
    );
    expect(
      serializableValueToJavaScript(array([string("foo"), number(123)]))
    ).toMatchInlineSnapshot('"[\\"foo\\", 123]"');
  });

  test("boolean", () => {
    expect(serializableValueToJavaScript(TRUE)).toMatchInlineSnapshot('"true"');
    expect(serializableValueToJavaScript(FALSE)).toMatchInlineSnapshot(
      '"false"'
    );
  });

  test("function", () => {
    expect(serializableValueToJavaScript(fn("() => { return foo; }")))
      .toMatchInlineSnapshot(`
        "() => {
          return foo;
        }"
      `);
    expect(
      serializableValueToJavaScript(fn("function foo(a, b) { return a + b; }"))
    ).toMatchInlineSnapshot(`
      "function foo(a, b) {
        return a + b;
      }"
    `);
  });

  test("map", () => {
    expect(serializableValueToJavaScript(EMPTY_MAP)).toMatchInlineSnapshot(
      '"new Map()"'
    );
    expect(
      serializableValueToJavaScript(
        map(
          object([
            {
              kind: "key",
              key: string("foo"),
              value: number(123),
            },
          ])
        )
      )
    ).toMatchInlineSnapshot(`
      "new Map(
        Object.entries({
          foo: 123
        })
      )"
    `);
  });

  test("node", () => {
    expect(
      serializableValueToJavaScript(node("", EMPTY_OBJECT, []))
    ).toMatchInlineSnapshot('"<></>"');
    expect(
      serializableValueToJavaScript(node("div", EMPTY_OBJECT))
    ).toMatchInlineSnapshot('"<div />"');
    expect(
      serializableValueToJavaScript(node("A", EMPTY_OBJECT))
    ).toMatchInlineSnapshot('"<A />"');
    expect(
      serializableValueToJavaScript(node("A", EMPTY_OBJECT, []))
    ).toMatchInlineSnapshot('"<A></A>"');
    expect(
      serializableValueToJavaScript(node("A", EMPTY_OBJECT, [string("foo")]))
    ).toMatchInlineSnapshot('"<A>foo</A>"');
    expect(
      serializableValueToJavaScript(node("A", EMPTY_OBJECT, [unknown("foo")]))
    ).toMatchInlineSnapshot('"<A>{foo}</A>"');
    expect(
      serializableValueToJavaScript(
        node("A", EMPTY_OBJECT, [string("foo"), unknown("bar"), string("baz")])
      )
    ).toMatchInlineSnapshot(`
      "
        <A>
          foo
          {bar}
          baz
        </A>
      "
    `);
    expect(
      serializableValueToJavaScript(
        node("A", EMPTY_OBJECT, [
          node("b", EMPTY_OBJECT, [string("Hello")]),
          string(" "),
          node("i", EMPTY_OBJECT, [string("World")]),
        ])
      )
    ).toMatchInlineSnapshot(`
      "
        <A>
          <b>Hello</b> <i>World</i>
        </A>
      "
    `);
    expect(
      serializableValueToJavaScript(
        node("A", EMPTY_OBJECT, [string("foo"), string("bar")])
      )
    ).toMatchInlineSnapshot('"<A>foo bar</A>"');
    expect(
      serializableValueToJavaScript(
        node("A", EMPTY_OBJECT, [string("foo"), string(" "), string("bar")])
      )
    ).toMatchInlineSnapshot('"<A>foo bar</A>"');
    expect(
      serializableValueToJavaScript(
        node("A", EMPTY_OBJECT, [string("foo"), string("   "), string("bar")])
      )
    ).toMatchInlineSnapshot(`
      "
        <A>
          foo
          {\\"   \\"}
          bar
        </A>
      "
    `);
    const complexProps = object([
      {
        kind: "spread",
        value: object([
          {
            kind: "key",
            key: string("str"),
            value: string("foo"),
          },
        ]),
      },
      {
        kind: "key",
        key: string("str"),
        value: string("bar"),
      },
      {
        kind: "key",
        key: string("num"),
        value: number(123),
      },
      {
        kind: "key",
        key: string("positive"),
        value: TRUE,
      },
      {
        kind: "key",
        key: string("negative"),
        value: FALSE,
      },
      {
        kind: "key",
        key: string("obj"),
        value: object([]),
      },
      {
        kind: "key",
        key: string("func"),
        value: fn("() => { /* function source */ }"),
      },
    ]);
    expect(serializableValueToJavaScript(node("A", complexProps)))
      .toMatchInlineSnapshot(`
        "
          <A
            {...{
              str: \\"foo\\"
            }}
            str=\\"bar\\"
            num={123}
            positive
            negative={false}
            obj={{}}
            func={() => {
              /* function source */
            }}
          />
        "
      `);
    expect(serializableValueToJavaScript(node("A", complexProps, [])))
      .toMatchInlineSnapshot(`
        "
          <A
            {...{
              str: \\"foo\\"
            }}
            str=\\"bar\\"
            num={123}
            positive
            negative={false}
            obj={{}}
            func={() => {
              /* function source */
            }}
          ></A>
        "
      `);
    expect(
      serializableValueToJavaScript(
        node("A", complexProps, [node("div", EMPTY_OBJECT)])
      )
    ).toMatchInlineSnapshot(`
      "
        <A
          {...{
            str: \\"foo\\"
          }}
          str=\\"bar\\"
          num={123}
          positive
          negative={false}
          obj={{}}
          func={() => {
            /* function source */
          }}
        >
          <div />
        </A>
      "
    `);
  });

  test("null", () => {
    expect(serializableValueToJavaScript(NULL)).toMatchInlineSnapshot('"null"');
  });

  test("number", () => {
    expect(serializableValueToJavaScript(number(0))).toMatchInlineSnapshot(
      '"0"'
    );
    expect(serializableValueToJavaScript(number(123))).toMatchInlineSnapshot(
      '"123"'
    );
    expect(serializableValueToJavaScript(number(-45.6))).toMatchInlineSnapshot(
      '"-45.6"'
    );
  });

  test("object", () => {
    expect(serializableValueToJavaScript(EMPTY_OBJECT)).toMatchInlineSnapshot(
      '"{}"'
    );
    expect(
      serializableValueToJavaScript(
        object([
          {
            kind: "key",
            key: string("foo"),
            value: number(123),
          },
        ])
      )
    ).toMatchInlineSnapshot(`
      "{
        foo: 123
      }"
    `);
  });

  test("promise", () => {
    expect(
      serializableValueToJavaScript(
        promise({
          type: "resolve",
          value: UNDEFINED,
        })
      )
    ).toMatchInlineSnapshot('"Promise.resolve(undefined)"');
    expect(
      serializableValueToJavaScript(
        promise({
          type: "resolve",
          value: number(123),
        })
      )
    ).toMatchInlineSnapshot('"Promise.resolve(123)"');
    expect(
      serializableValueToJavaScript(
        promise({
          type: "reject",
          message: null,
        })
      )
    ).toMatchInlineSnapshot('"Promise.reject()"');
    expect(
      serializableValueToJavaScript(
        promise({
          type: "reject",
          message: "an error occurred",
        })
      )
    ).toMatchInlineSnapshot(
      '"Promise.reject(new Error(\\"an error occurred\\"))"'
    );
  });

  test("set", () => {
    expect(serializableValueToJavaScript(EMPTY_SET)).toMatchInlineSnapshot(
      '"new Set()"'
    );
    expect(
      serializableValueToJavaScript(set(array([number(123), string("foo")])))
    ).toMatchInlineSnapshot('"new Set([123, \\"foo\\"])"');
  });

  test("string", () => {
    expect(serializableValueToJavaScript(string(""))).toMatchInlineSnapshot(
      '"\\"\\""'
    );
    expect(serializableValueToJavaScript(string("foo"))).toMatchInlineSnapshot(
      '"\\"foo\\""'
    );
    expect(
      serializableValueToJavaScript(string("a'b\"c`"))
    ).toMatchInlineSnapshot('"\\"a\'b\\\\\\"c`\\""');
  });

  test("undefined", () => {
    expect(serializableValueToJavaScript(UNDEFINED)).toMatchInlineSnapshot(
      '"undefined"'
    );
  });

  test("unknown", () => {
    expect(serializableValueToJavaScript(UNKNOWN)).toMatchInlineSnapshot(
      '"{}"'
    );
    expect(
      serializableValueToJavaScript(unknown('{ foo: "bar" }'))
    ).toMatchInlineSnapshot('"{ foo: \\"bar\\" }"');
    expect(serializableValueToJavaScript(unknown("foo"))).toMatchInlineSnapshot(
      '"foo"'
    );
    expect(
      serializableValueToJavaScript(unknown("foo bar"))
    ).toMatchInlineSnapshot('"foo bar"');
    expect(serializableValueToJavaScript(unknown("new"))).toMatchInlineSnapshot(
      '"new"'
    );
    expect(serializableValueToJavaScript(unknown("'"))).toMatchInlineSnapshot(
      '"\'"'
    );
    expect(serializableValueToJavaScript(unknown(""))).toMatchInlineSnapshot(
      '""'
    );
  });
});

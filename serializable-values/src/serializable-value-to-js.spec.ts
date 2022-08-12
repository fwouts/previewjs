import { describe, expect, test } from "vitest";
import {
  array,
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
  set,
  string,
  TRUE,
  UNDEFINED,
  unknown,
  UNKNOWN,
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
    expect(serializableValueToJavaScript(fn(UNDEFINED))).toMatchInlineSnapshot(
      '"() => {}"'
    );
    expect(serializableValueToJavaScript(fn(number(0)))).toMatchInlineSnapshot(
      '"() => 0"'
    );
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
    expect(serializableValueToJavaScript(unknown("new"))).toMatchInlineSnapshot(
      '"{}"'
    );
    expect(serializableValueToJavaScript(unknown("'"))).toMatchInlineSnapshot(
      '"{}"'
    );
    expect(serializableValueToJavaScript(unknown(""))).toMatchInlineSnapshot(
      '"{}"'
    );
  });
});

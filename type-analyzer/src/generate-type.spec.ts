import { describe, expect, test } from "vitest";
import {
  ANY_TYPE,
  BOOLEAN_TYPE,
  NEVER_TYPE,
  NODE_TYPE,
  NULL_TYPE,
  NUMBER_TYPE,
  STRING_TYPE,
  UNKNOWN_TYPE,
  VOID_TYPE,
  arrayType,
  enumType,
  functionType,
  intersectionType,
  literalType,
  namedType,
  objectType,
  promiseType,
  recordType,
  setType,
  tupleType,
  unionType,
} from "./definitions";
import { generateType } from "./generate-type";

describe("generateType", () => {
  test("any", () => {
    expect(generateType(ANY_TYPE, {})).toMatchInlineSnapshot('"any"');
  });

  test("unknown", () => {
    expect(generateType(UNKNOWN_TYPE, {})).toMatchInlineSnapshot('"unknown"');
  });

  test("never", () => {
    expect(generateType(NEVER_TYPE, {})).toMatchInlineSnapshot('"never"');
  });

  test("void", () => {
    expect(generateType(VOID_TYPE, {})).toMatchInlineSnapshot('"void"');
  });

  test("null", () => {
    expect(generateType(NULL_TYPE, {})).toMatchInlineSnapshot('"null"');
  });

  test("boolean", () => {
    expect(generateType(BOOLEAN_TYPE, {})).toMatchInlineSnapshot('"boolean"');
  });

  test("string", () => {
    expect(generateType(STRING_TYPE, {})).toMatchInlineSnapshot('"string"');
  });

  test("number", () => {
    expect(generateType(NUMBER_TYPE, {})).toMatchInlineSnapshot('"number"');
  });

  test("node", () => {
    // TODO: Consider changing this to `string | JSX.Element`.
    expect(generateType(NODE_TYPE, {})).toMatchInlineSnapshot('"any"');
  });

  test("number literal", () => {
    expect(generateType(literalType(123), {})).toMatchInlineSnapshot('"123"');
  });

  test("string literal", () => {
    expect(generateType(literalType("foo"), {})).toMatchInlineSnapshot(
      '"\\"foo\\""'
    );
  });

  test("true literal", () => {
    expect(generateType(literalType(true), {})).toMatchInlineSnapshot('"true"');
  });

  test("false literal", () => {
    expect(generateType(literalType(false), {})).toMatchInlineSnapshot(
      '"false"'
    );
  });

  test("string enum", () => {
    expect(
      generateType(
        enumType({
          a: "A",
          b: "B",
          c: "C",
        }),
        {}
      )
    ).toMatchInlineSnapshot('"\\"A\\" | \\"B\\" | \\"C\\""');
  });

  test("number enum", () => {
    expect(
      generateType(
        enumType({
          a: 3,
          b: 2,
          c: 1,
        }),
        {}
      )
    ).toMatchInlineSnapshot('"3 | 2 | 1"');
  });

  test("array", () => {
    expect(generateType(arrayType(STRING_TYPE), {})).toMatchInlineSnapshot(
      '"Array<string>"'
    );
  });

  test("set", () => {
    expect(generateType(setType(STRING_TYPE), {})).toMatchInlineSnapshot(
      '"Set<string>"'
    );
  });

  test("tuple", () => {
    expect(
      generateType(tupleType([STRING_TYPE, NUMBER_TYPE]), {})
    ).toMatchInlineSnapshot('"[string, number]"');
  });

  test("record", () => {
    expect(
      generateType(recordType(STRING_TYPE, NUMBER_TYPE), {})
    ).toMatchInlineSnapshot('"Record<string, number>"');
  });

  test("union", () => {
    expect(
      generateType(unionType([STRING_TYPE, NUMBER_TYPE]), {})
    ).toMatchInlineSnapshot('"(string) | (number)"');
  });

  test("intersection", () => {
    expect(
      generateType(intersectionType([STRING_TYPE, NUMBER_TYPE]), {})
    ).toMatchInlineSnapshot('"(string) & (number)"');
  });

  test("function", () => {
    expect(generateType(functionType(STRING_TYPE), {})).toMatchInlineSnapshot(
      '"(...params: any[]) => (string)"'
    );
  });

  test("promise", () => {
    expect(generateType(promiseType(STRING_TYPE), {})).toMatchInlineSnapshot(
      '"Promise<string>"'
    );
  });

  test("named", () => {
    expect(generateType(namedType("/foo.tsx:Bar"), {})).toMatchInlineSnapshot(
      '"Bar"'
    );
  });

  test("object", () => {
    expect(
      generateType(
        objectType({
          foo: STRING_TYPE,
        }),
        {}
      )
    ).toMatchInlineSnapshot(`
      "{
                      [\\"foo\\"]: string
                    }"
    `);
  });
});

import {
  ANY_TYPE,
  arrayType,
  BOOLEAN_TYPE,
  enumType,
  functionType,
  intersectionType,
  literalType,
  namedType,
  NEVER_TYPE,
  NODE_TYPE,
  NULL_TYPE,
  NUMBER_TYPE,
  objectType,
  optionalType,
  promiseType,
  recordType,
  setType,
  STRING_TYPE,
  tupleType,
  unionType,
  UNKNOWN_TYPE,
  VOID_TYPE,
} from "@previewjs/type-analyzer";
import { describe, expect, test } from "vitest";
import { generateSerializableValue } from "./generate-serializable-value";

describe("generateSerializableValue", () => {
  test("simple props with object type", () => {
    expect(
      generateSerializableValue(
        objectType({
          foo: STRING_TYPE,
        }),

        {}
      )
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "foo",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "foo",
            },
          },
        ],
        "kind": "object",
      }
    `);
  });

  test("simple props with named type", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:MyComponentProps"), {
        "/foo.tsx:MyComponentProps": {
          type: objectType({
            foo: STRING_TYPE,
          }),

          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "foo",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "foo",
            },
          },
        ],
        "kind": "object",
      }
    `);
  });

  test("recursive named type", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:Foo"), {
        "/foo.tsx:Foo": {
          type: objectType({
            child: namedType("/foo.tsx:Bar"),
            union: unionType([BOOLEAN_TYPE, namedType("/foo.tsx:Foo")]),
          }),
          parameters: {},
        },

        "/foo.tsx:Bar": {
          type: objectType({
            child: optionalType(namedType("/foo.tsx:Foo")),
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "child",
            },
            "kind": "key",
            "value": {
              "entries": [],
              "kind": "object",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "union",
            },
            "kind": "key",
            "value": {
              "kind": "boolean",
              "value": false,
            },
          },
        ],
        "kind": "object",
      }
    `);
  });

  test("recursive function type", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:MyComponentProps"), {
        "/foo.tsx:MyComponentProps": {
          type: objectType({
            foo: namedType("/foo.tsx:Fn"),
          }),

          parameters: {},
        },

        "/foo.tsx:Fn": {
          type: functionType(namedType("/foo.tsx:Fn")),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "foo",
            },
            "kind": "key",
            "value": {
              "kind": "function",
              "source": "() => ({})",
            },
          },
        ],
        "kind": "object",
      }
    `);
  });

  test("self-returning type", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:User"), {
        "/foo.tsx:User": {
          type: objectType({
            target: namedType("/foo.tsx:User"),
            friends: functionType(arrayType(namedType("/foo.tsx:User"))),
          }),

          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "target",
            },
            "kind": "key",
            "value": {
              "entries": [],
              "kind": "object",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "friends",
            },
            "kind": "key",
            "value": {
              "kind": "function",
              "source": "() => []",
            },
          },
        ],
        "kind": "object",
      }
    `);
  });

  test("all types", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:Foo"), {
        "/foo.tsx:Foo": {
          type: objectType({
            anyType: ANY_TYPE,
            unknownType: UNKNOWN_TYPE,
            neverType: NEVER_TYPE,
            voidType: VOID_TYPE,
            nullType: NULL_TYPE,
            booleanType: BOOLEAN_TYPE,
            stringType: STRING_TYPE,
            numberType: NUMBER_TYPE,
            reactNodeType: NODE_TYPE,
            numberLiteral: literalType(123),
            stringLiteral: literalType("foo"),
            trueLiteral: literalType(true),
            falseLiteral: literalType(false),
            stringEnumType: enumType({
              a: "A",
              b: "B",
              c: "C",
            }),

            numberEnumType: enumType({
              a: 3,
              b: 2,
              c: 1,
            }),

            arrayType: arrayType(STRING_TYPE),
            setType: setType(STRING_TYPE),
            tupleType: tupleType([STRING_TYPE, NUMBER_TYPE]),
            recordType: recordType(STRING_TYPE, NUMBER_TYPE),
            unionType: unionType([STRING_TYPE, NUMBER_TYPE]),
            intersectionType: intersectionType([STRING_TYPE, NUMBER_TYPE]),
            functionType: functionType(STRING_TYPE),
            promiseType: promiseType(STRING_TYPE),
            namedType: namedType("/foo.tsx:Bar"),
          }),

          parameters: {},
        },

        "/foo.tsx:Bar": {
          type: objectType({
            bar: functionType(STRING_TYPE),
          }),

          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "nullType",
            },
            "kind": "key",
            "value": {
              "kind": "null",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "booleanType",
            },
            "kind": "key",
            "value": {
              "kind": "boolean",
              "value": false,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "stringType",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "stringType",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "numberType",
            },
            "kind": "key",
            "value": {
              "kind": "number",
              "value": 0,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "reactNodeType",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "reactNodeType",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "numberLiteral",
            },
            "kind": "key",
            "value": {
              "kind": "number",
              "value": 123,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "stringLiteral",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "foo",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "trueLiteral",
            },
            "kind": "key",
            "value": {
              "kind": "boolean",
              "value": true,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "falseLiteral",
            },
            "kind": "key",
            "value": {
              "kind": "boolean",
              "value": false,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "stringEnumType",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "A",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "numberEnumType",
            },
            "kind": "key",
            "value": {
              "kind": "number",
              "value": 3,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "arrayType",
            },
            "kind": "key",
            "value": {
              "items": [
                {
                  "kind": "string",
                  "value": "arrayType",
                },
              ],
              "kind": "array",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "setType",
            },
            "kind": "key",
            "value": {
              "kind": "set",
              "values": {
                "items": [
                  {
                    "kind": "string",
                    "value": "setType",
                  },
                ],
                "kind": "array",
              },
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "tupleType",
            },
            "kind": "key",
            "value": {
              "items": [
                {
                  "kind": "string",
                  "value": "tupleType",
                },
                {
                  "kind": "number",
                  "value": 0,
                },
              ],
              "kind": "array",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "recordType",
            },
            "kind": "key",
            "value": {
              "entries": [],
              "kind": "object",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "unionType",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "unionType",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "intersectionType",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "intersectionType",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "functionType",
            },
            "kind": "key",
            "value": {
              "kind": "function",
              "source": "() => \\"functionType\\"",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "promiseType",
            },
            "kind": "key",
            "value": {
              "kind": "promise",
              "value": {
                "message": null,
                "type": "reject",
              },
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "namedType",
            },
            "kind": "key",
            "value": {
              "entries": [
                {
                  "key": {
                    "kind": "string",
                    "value": "bar",
                  },
                  "kind": "key",
                  "value": {
                    "kind": "function",
                    "source": "() => \\"bar\\"",
                  },
                },
              ],
              "kind": "object",
            },
          },
        ],
        "kind": "object",
      }
    `);
  });

  test("optional props in object type", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:Foo"), {
        "/foo.tsx:Foo": {
          type: objectType({
            a: STRING_TYPE,
            b: optionalType(STRING_TYPE),
            c: ANY_TYPE,
            d: UNKNOWN_TYPE,
            e: STRING_TYPE,
            f: optionalType(STRING_TYPE),
          }),

          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "a",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "a",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "e",
            },
            "kind": "key",
            "value": {
              "kind": "string",
              "value": "e",
            },
          },
        ],
        "kind": "object",
      }
    `);
  });

  test("missing named type", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:Foo"), {
        "/foo.tsx:Foo": {
          type: objectType({
            a: namedType("/foo.tsx:Missing"),
          }),

          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [],
        "kind": "object",
      }
    `);
  });

  test("generic types", () => {
    expect(
      generateSerializableValue(namedType("/foo.tsx:A"), {
        "/foo.tsx:A": {
          type: namedType("/foo.tsx:C", [namedType("T")]),
          parameters: { T: NUMBER_TYPE },
        },

        "/foo.tsx:B": {
          type: objectType({
            foo: namedType("/foo.tsx:C", [namedType("/foo.tsx:B")]),
          }),

          parameters: {},
        },

        "/foo.tsx:C": {
          type: objectType({
            t: namedType("T"),
            s: namedType("S"),
          }),

          parameters: {
            T: null,
            S: namedType("T"),
          },
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "entries": [
          {
            "key": {
              "kind": "string",
              "value": "t",
            },
            "kind": "key",
            "value": {
              "kind": "number",
              "value": 0,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "s",
            },
            "kind": "key",
            "value": {
              "kind": "number",
              "value": 0,
            },
          },
        ],
        "kind": "object",
      }
    `);
  });
});

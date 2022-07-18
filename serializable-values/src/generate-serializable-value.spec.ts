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
            "value": {
              "entries": [],
              "kind": "object",
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
            "value": {
              "kind": "function",
              "returnValue": {
                "kind": "undefined",
              },
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
              "value": "friends",
            },
            "value": {
              "kind": "function",
              "returnValue": {
                "items": [],
                "kind": "array",
              },
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
            "value": {
              "kind": "null",
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "booleanType",
            },
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
            "value": {
              "kind": "number",
              "value": 100,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "reactNodeType",
            },
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
              "value": "recordType",
            },
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
            "value": {
              "kind": "function",
              "returnValue": {
                "kind": "string",
                "value": "functionType",
              },
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "promiseType",
            },
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
            "value": {
              "entries": [
                {
                  "key": {
                    "kind": "string",
                    "value": "bar",
                  },
                  "value": {
                    "kind": "function",
                    "returnValue": {
                      "kind": "string",
                      "value": "bar",
                    },
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
            "value": {
              "kind": "number",
              "value": 100,
            },
          },
          {
            "key": {
              "kind": "string",
              "value": "s",
            },
            "value": {
              "kind": "number",
              "value": 100,
            },
          },
        ],
        "kind": "object",
      }
    `);
  });
});

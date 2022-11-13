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
  promiseType,
  recordType,
  setType,
  STRING_TYPE,
  unionType,
  UNKNOWN_TYPE,
  VOID_TYPE,
} from "@previewjs/type-analyzer";
import { describe, expect, test } from "vitest";
import { generatePropsAssignmentSource } from "./generate-props-assignment-source";

describe("generatePropsAssignmentSource", () => {
  test("simple props with object type", () => {
    expect(
      generatePropsAssignmentSource(
        objectType({
          foo: STRING_TYPE,
        }),
        [],
        {}
      )
    ).toMatchInlineSnapshot(`
      "properties = {
        foo: \\"foo\\"
      };"
    `);
  });

  test("simple props with named type", () => {
    expect(
      generatePropsAssignmentSource(
        namedType("/foo.tsx:MyComponentProps"),
        [],
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({
              foo: STRING_TYPE,
            }),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      "properties = {
        foo: \\"foo\\"
      };"
    `);
  });

  test("recursive type", () => {
    expect(
      generatePropsAssignmentSource(
        namedType("/foo.tsx:MyComponentProps"),
        [],
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({
              foo: STRING_TYPE,
              recursive: namedType("/foo.tsx:MyComponentProps", []),
            }),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      "properties = {
        foo: \\"foo\\",
        recursive: {
          foo: \\"foo\\",
          recursive: {}
        }
      };"
    `);
  });

  test("all types", () => {
    expect(
      generatePropsAssignmentSource(namedType("/foo.tsx:Foo"), [], {
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
      "properties = {
        nullType: null,
        booleanType: false,
        stringType: \\"stringType\\",
        numberType: 0,
        reactNodeType: \\"reactNodeType\\",
        numberLiteral: 123,
        stringLiteral: \\"foo\\",
        trueLiteral: true,
        falseLiteral: false,
        stringEnumType: \\"A\\",
        numberEnumType: 3,
        arrayType: [\\"arrayType\\"],
        setType: new Set([\\"setType\\"]),
        recordType: {},
        unionType: \\"unionType\\",
        intersectionType: \\"intersectionType\\",
        functionType: () => \\"functionType\\",
        promiseType: Promise.reject(),
        namedType: {
          bar: () => \\"bar\\"
        }
      };"
    `);
  });

  test("ignores provided keys", () => {
    expect(
      generatePropsAssignmentSource(
        namedType("/foo.tsx:MyComponentProps"),
        ["foo"],
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({
              foo: STRING_TYPE,
              bar: STRING_TYPE,
            }),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      "properties = {
        bar: \\"bar\\"
      };"
    `);
  });
});

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
import { generateValue } from "./generate-value";

describe("generateValue", () => {
  test("simple props with object type", () => {
    expect(
      generateValue(
        objectType({
          foo: STRING_TYPE,
        }),

        {},
        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      foo: \\"foo\\",

      }"
    `);
  });

  test("simple props with named type", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:MyComponentProps"),
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({
              foo: STRING_TYPE,
            }),

            parameters: {},
          },
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      foo: \\"foo\\",

      }"
    `);
  });

  test("recursive named type", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:Foo"),
        {
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
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      child: {

      },

      }"
    `);
  });

  test("recursive function type", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:MyComponentProps"),
        {
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
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      foo: () => {},

      }"
    `);
  });

  test("self-returning type", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:User"),
        {
          "/foo.tsx:User": {
            type: objectType({
              target: namedType("/foo.tsx:User"),
              friends: functionType(arrayType(namedType("/foo.tsx:User"))),
            }),

            parameters: {},
          },
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      friends: () => ([]),

      }"
    `);
  });

  test("all types", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:Foo"),
        {
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
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      nullType: null,
      booleanType: false,
      stringType: \\"stringType\\",
      numberType: 100,
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
      functionType: () => (\\"functionType\\"),
      promiseType: Promise.reject(),
      namedType: {
      bar: () => (\\"namedType.bar\\"),

      },

      }"
    `);
  });

  test("optional props in object type", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:Foo"),
        {
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
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      a: \\"a\\",
      e: \\"e\\",

      }"
    `);
  });

  test("missing named type", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:Foo"),
        {
          "/foo.tsx:Foo": {
            type: objectType({
              a: namedType("/foo.tsx:Missing"),
            }),

            parameters: {},
          },
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{

      }"
    `);
  });

  test("generic types", () => {
    expect(
      generateValue(
        namedType("/foo.tsx:A"),
        {
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
        },

        [],
        [],
        false
      )
    ).toMatchInlineSnapshot(`
      "{
      t: 100,
      s: 100,

      }"
    `);
  });
});

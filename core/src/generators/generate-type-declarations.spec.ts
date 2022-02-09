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
import { generateTypeDeclarations } from "./generate-type-declarations";

describe("generateTypeDeclarations", () => {
  test("simple props with object type", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        objectType({
          foo: STRING_TYPE,
        }),

        new Set([]),
        {}
      )
    ).toMatchSnapshot();
  });

  test("simple props with named type", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:MyComponentProps"),
        new Set([]),
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({
              foo: STRING_TYPE,
            }),
            parameters: {},
          },
        }
      )
    ).toMatchSnapshot();

    expect(
      generateTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:Foo"),
        new Set([]),
        {
          "/foo.tsx:Foo": {
            type: objectType({
              foo: STRING_TYPE,
            }),
            parameters: {},
          },
        }
      )
    ).toMatchSnapshot();
  });

  test("recursive named type", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:Foo"),
        new Set([]),
        {
          "/foo.tsx:Foo": {
            type: objectType({
              child: optionalType(namedType("/foo.tsx:Foo")),
            }),
            parameters: {},
          },
        }
      )
    ).toMatchSnapshot();
  });

  test("recursive function type", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:MyComponentProps"),
        new Set([]),
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({
              foo: namedType("/foo.tsx:Fn"),
            }),
            parameters: {},
          },
          "/foo.tsx:Fn": {
            type: functionType(optionalType(namedType("/foo.tsx:Fn"))),
            parameters: {},
          },
        }
      )
    ).toMatchSnapshot();
  });

  test("all types", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:Foo"),
        new Set([]),
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
        }
      )
    ).toMatchSnapshot();
  });

  test("duplicate types in different files", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:Foo"),
        new Set([]),
        {
          "/foo.tsx:Foo": {
            type: objectType({
              foo: namedType("/bar.tsx:Foo"),
            }),
            parameters: {},
          },
          "/bar.tsx:Foo": {
            type: objectType({
              bar: namedType("/baz.tsx:Foo"),
            }),
            parameters: {},
          },
          "/baz.tsx:Foo": {
            type: objectType({
              baz: STRING_TYPE,
            }),
            parameters: {},
          },
        }
      )
    ).toMatchSnapshot();
  });

  test("optional props in object type", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        objectType({
          a: STRING_TYPE,
          b: optionalType(STRING_TYPE),
          c: ANY_TYPE,
          d: UNKNOWN_TYPE,
          e: STRING_TYPE,
          f: optionalType(STRING_TYPE),
        }),
        new Set([]),
        {}
      )
    ).toMatchSnapshot();
  });

  test("generic types", () => {
    expect(
      generateTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:A"),
        new Set([]),
        {
          "/foo.tsx:A": {
            type: namedType("T"),
            parameters: { T: namedType("/foo.tsx:B") },
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
        }
      )
    ).toMatchSnapshot();
  });
});

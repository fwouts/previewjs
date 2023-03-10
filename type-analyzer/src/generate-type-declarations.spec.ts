import { describe, expect, test } from "vitest";
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
} from "./definitions";
import { generateTypeDeclarations } from "./generate-type-declarations";

describe("generateTypeDeclarations", () => {
  test("no types", () => {
    expect(
      generateTypeDeclarations([], {
        A: {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot('""');
  });

  test("simple object type", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:Foo"], {
        "/foo.tsx:Foo": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      "type Foo = {
        [\\"foo\\"]: string;
      };"
    `);
  });

  test("recursive named type", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:Foo"], {
        "/foo.tsx:Foo": {
          type: objectType({
            child: optionalType(namedType("/foo.tsx:Foo")),
            children: arrayType(namedType("/foo.tsx:Foo")),
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      "type Foo = {
        [\\"child\\"]?: Foo | undefined;
        [\\"children\\"]: Array<Foo>;
      };"
    `);
  });

  test("recursive function type", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:MyComponentProps"], {
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
      })
    ).toMatchInlineSnapshot(`
      "type MyComponentProps = {
        [\\"foo\\"]: Fn;
      };

      type Fn = (...params: any[]) => Fn | undefined;"
    `);
  });

  test("all types", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:Foo"], {
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
      "type Foo = {
        [\\"anyType\\"]?: any;
        [\\"unknownType\\"]?: unknown;
        [\\"neverType\\"]: never;
        [\\"voidType\\"]: void;
        [\\"nullType\\"]: null;
        [\\"booleanType\\"]: boolean;
        [\\"stringType\\"]: string;
        [\\"numberType\\"]: number;
        [\\"reactNodeType\\"]: any;
        [\\"numberLiteral\\"]: 123;
        [\\"stringLiteral\\"]: \\"foo\\";
        [\\"trueLiteral\\"]: true;
        [\\"falseLiteral\\"]: false;
        [\\"stringEnumType\\"]: \\"A\\" | \\"B\\" | \\"C\\";
        [\\"numberEnumType\\"]: 3 | 2 | 1;
        [\\"arrayType\\"]: Array<string>;
        [\\"setType\\"]: Set<string>;
        [\\"tupleType\\"]: [string, number];
        [\\"recordType\\"]: Record<string, number>;
        [\\"unionType\\"]: string | number;
        [\\"intersectionType\\"]: string & number;
        [\\"functionType\\"]: (...params: any[]) => string;
        [\\"promiseType\\"]: Promise<string>;
        [\\"namedType\\"]: Bar;
      };

      type Bar = {
        [\\"bar\\"]: (...params: any[]) => string;
      };"
    `);
  });

  test("duplicate types in different files", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:Foo"], {
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
      })
    ).toMatchInlineSnapshot(`
      "type Foo = {
        [\\"foo\\"]: Foo_2;
      };

      type Foo_2 = {
        [\\"bar\\"]: Foo_3;
      };

      type Foo_3 = {
        [\\"baz\\"]: string;
      };"
    `);
  });

  test("optional props in object type", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:Foo"], {
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
      "type Foo = {
        [\\"a\\"]: string;
        [\\"b\\"]?: string | undefined;
        [\\"c\\"]?: any;
        [\\"d\\"]?: unknown;
        [\\"e\\"]: string;
        [\\"f\\"]?: string | undefined;
      };"
    `);
  });

  test("generic types", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:A"], {
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
      })
    ).toMatchInlineSnapshot(`
      "type A<T = B> = T;

      type B = {
        [\\"foo\\"]: C<B>;
      };

      type C<T, S = T> = {
        [\\"t\\"]: T;
        [\\"s\\"]: S;
      };"
    `);
  });

  test("reserved type names", () => {
    expect(
      generateTypeDeclarations(["/foo.tsx:default"], {
        "/foo.tsx:default": {
          type: namedType("T"),
          parameters: { T: namedType("/foo.tsx:for") },
        },
        "/foo.tsx:for": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      "type default_2<T = for_2> = T;

      type for_2 = {
        [\\"foo\\"]: string;
      };"
    `);
  });
});

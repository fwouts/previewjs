import {
  functionType,
  namedType,
  objectType,
  optionalType,
  STRING_TYPE,
} from "@previewjs/type-analyzer";
import { describe, expect, test } from "vitest";
import { generatePropsTypeDeclarations } from "./generate-type-declarations";

describe("generatePropsTypeDeclarations", () => {
  test("simple props with object type", () => {
    expect(
      generatePropsTypeDeclarations(
        "MyComponent",
        objectType({
          foo: STRING_TYPE,
        }),
        [],
        {}
      )
    ).toMatchInlineSnapshot(`
      "declare let properties: MyComponentProps;

      declare function fn<T>(name: string, returnValue?: T): () => T;

      type MyComponentProps = {
        [\\"foo\\"]: string;
      };
      "
    `);
  });

  test("simple props with named type", () => {
    expect(
      generatePropsTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:Foo"),
        [],
        {
          "/foo.tsx:Foo": {
            type: objectType({
              foo: STRING_TYPE,
            }),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      "declare let properties: Foo;

      declare function fn<T>(name: string, returnValue?: T): () => T;

      type Foo = {
        [\\"foo\\"]: string;
      };
      "
    `);
  });

  test("conflicting prop types names", () => {
    expect(
      generatePropsTypeDeclarations(
        "MyComponent",
        objectType({
          foo: namedType("/foo.tsx:MyComponentProps"),
        }),
        [],
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({}),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      "declare let properties: MyComponentProps;

      declare function fn<T>(name: string, returnValue?: T): () => T;

      type MyComponentProps = {
        [\\"foo\\"]: MyComponentProps_2;
      };

      type MyComponentProps_2 = {};
      "
    `);
  });

  test("inline type with props that should be made optional", () => {
    expect(
      generatePropsTypeDeclarations(
        "MyComponent",
        objectType({
          foo: STRING_TYPE,
          bar: STRING_TYPE,
          baz: functionType(STRING_TYPE),
        }),
        ["foo"],
        {}
      )
    ).toMatchInlineSnapshot(`
      "declare let properties: MyComponentProps;

      declare function fn<T>(name: string, returnValue?: T): () => T;

      type MyComponentProps = {
        [\\"foo\\"]?: string | undefined;
        [\\"bar\\"]: string;
        [\\"baz\\"]?: (...params: any[]) => string | undefined;
      };
      "
    `);
  });

  test("named type with props that should be made optional", () => {
    expect(
      generatePropsTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:Foo"),
        ["foo"],
        {
          "/foo.tsx:Foo": {
            type: objectType({
              foo: STRING_TYPE,
              bar: STRING_TYPE,
              baz: functionType(STRING_TYPE),
            }),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      "declare let properties: Foo;

      declare function fn<T>(name: string, returnValue?: T): () => T;

      type Foo = {
        [\\"foo\\"]?: string | undefined;
        [\\"bar\\"]: string;
        [\\"baz\\"]?: (...params: any[]) => string | undefined;
      };
      "
    `);
  });

  test("recursive named type", () => {
    expect(
      generatePropsTypeDeclarations(
        "MyComponent",
        namedType("/foo.tsx:Foo"),
        [],
        {
          "/foo.tsx:Foo": {
            type: objectType({
              child: optionalType(namedType("/foo.tsx:Foo")),
            }),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      "declare let properties: Foo;

      declare function fn<T>(name: string, returnValue?: T): () => T;

      type Foo = {
        [\\"child\\"]?: Foo | undefined;
      };
      "
    `);
  });
});

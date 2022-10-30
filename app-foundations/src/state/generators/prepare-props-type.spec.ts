import {
  functionType,
  namedType,
  objectType,
  optionalType,
  STRING_TYPE,
} from "@previewjs/type-analyzer";
import { describe, expect, test } from "vitest";
import { preparePropsType } from "./prepare-props-type";

describe("preparePropsType", () => {
  test("simple props with object type", () => {
    expect(
      preparePropsType(
        "MyComponent",
        objectType({
          foo: STRING_TYPE,
        }),
        {}
      )
    ).toMatchInlineSnapshot(`
      {
        "propsTypeName": ":MyComponentProps",
        "types": {
          ":MyComponentProps": {
            "parameters": {},
            "type": {
              "fields": {
                "foo": {
                  "kind": "string",
                },
              },
              "kind": "object",
            },
          },
        },
      }
    `);
  });

  test("simple props with named type", () => {
    expect(
      preparePropsType("MyComponent", namedType("/foo.tsx:Foo"), {
        "/foo.tsx:Foo": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "propsTypeName": "/foo.tsx:Foo",
        "types": {
          "/foo.tsx:Foo": {
            "parameters": {},
            "type": {
              "fields": {
                "foo": {
                  "kind": "string",
                },
              },
              "kind": "object",
            },
          },
        },
      }
    `);
  });

  test("conflicting prop types names", () => {
    expect(
      preparePropsType(
        "MyComponent",
        objectType({
          foo: namedType("/foo.tsx:MyComponentProps"),
        }),
        {
          "/foo.tsx:MyComponentProps": {
            type: objectType({}),
            parameters: {},
          },
        }
      )
    ).toMatchInlineSnapshot(`
      {
        "propsTypeName": ":MyComponentProps",
        "types": {
          "/foo.tsx:MyComponentProps": {
            "parameters": {},
            "type": {
              "fields": {},
              "kind": "object",
            },
          },
          ":MyComponentProps": {
            "parameters": {},
            "type": {
              "fields": {
                "foo": {
                  "args": [],
                  "kind": "name",
                  "name": "/foo.tsx:MyComponentProps",
                },
              },
              "kind": "object",
            },
          },
        },
      }
    `);
  });

  test("inline type with props that should be made optional", () => {
    expect(
      preparePropsType(
        "MyComponent",
        objectType({
          foo: STRING_TYPE,
          bar: STRING_TYPE,
          baz: functionType(STRING_TYPE),
        }),
        {}
      )
    ).toMatchInlineSnapshot(`
      {
        "propsTypeName": ":MyComponentProps",
        "types": {
          ":MyComponentProps": {
            "parameters": {},
            "type": {
              "fields": {
                "bar": {
                  "kind": "string",
                },
                "baz": {
                  "kind": "optional",
                  "type": {
                    "kind": "function",
                    "returnType": {
                      "kind": "string",
                    },
                  },
                },
                "foo": {
                  "kind": "string",
                },
              },
              "kind": "object",
            },
          },
        },
      }
    `);
  });

  test("named type with props that should be made optional", () => {
    expect(
      preparePropsType("MyComponent", namedType("/foo.tsx:Foo"), {
        "/foo.tsx:Foo": {
          type: objectType({
            foo: STRING_TYPE,
            bar: STRING_TYPE,
            baz: functionType(STRING_TYPE),
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "propsTypeName": "/foo.tsx:Foo",
        "types": {
          "/foo.tsx:Foo": {
            "parameters": {},
            "type": {
              "fields": {
                "bar": {
                  "kind": "string",
                },
                "baz": {
                  "kind": "optional",
                  "type": {
                    "kind": "function",
                    "returnType": {
                      "kind": "string",
                    },
                  },
                },
                "foo": {
                  "kind": "string",
                },
              },
              "kind": "object",
            },
          },
        },
      }
    `);
  });

  test("recursive named type", () => {
    expect(
      preparePropsType("MyComponent", namedType("/foo.tsx:Foo"), {
        "/foo.tsx:Foo": {
          type: objectType({
            child: optionalType(namedType("/foo.tsx:Foo")),
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      {
        "propsTypeName": "/foo.tsx:Foo",
        "types": {
          "/foo.tsx:Foo": {
            "parameters": {},
            "type": {
              "fields": {
                "child": {
                  "kind": "optional",
                  "type": {
                    "args": [],
                    "kind": "name",
                    "name": "/foo.tsx:Foo",
                  },
                },
              },
              "kind": "object",
            },
          },
        },
      }
    `);
  });
});

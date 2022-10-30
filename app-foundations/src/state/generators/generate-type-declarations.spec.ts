import { namedType, objectType, STRING_TYPE } from "@previewjs/type-analyzer";
import { describe, expect, test } from "vitest";
import { generatePropsTypeDeclarations } from "./generate-type-declarations";

describe("generatePropsTypeDeclarations", () => {
  test("type exists", () => {
    expect(
      generatePropsTypeDeclarations(":MyComponentProps", {
        ":MyComponentProps": {
          type: objectType({
            foo: STRING_TYPE,
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      "declare let properties: MyComponentProps;

      type MyComponentProps = {
        [\\"foo\\"]: string;
      };
      "
    `);
  });
  test("conflicting type names", () => {
    expect(
      generatePropsTypeDeclarations(":MyComponentProps", {
        ":MyComponentProps": {
          type: objectType({
            foo: namedType("foo.tsx:MyComponentProps"),
          }),
          parameters: {},
        },
        "foo.tsx:MyComponentProps": {
          type: objectType({
            bar: STRING_TYPE,
          }),
          parameters: {},
        },
      })
    ).toMatchInlineSnapshot(`
      "declare let properties: MyComponentProps;

      type MyComponentProps = {
        [\\"foo\\"]: MyComponentProps_2;
      };

      type MyComponentProps_2 = {
        [\\"bar\\"]: string;
      };
      "
    `);
  });

  test("missing type", () => {
    expect(generatePropsTypeDeclarations(":Missing", {}))
      .toMatchInlineSnapshot(`
      "declare let properties: Missing;


      "
    `);
  });
});

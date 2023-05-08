import { describe, expect, test } from "vitest";
import { findTopLevelEntityNames, parse } from "./export-toplevel-plugin";

describe("exportToplevelPlugin", () => {
  test("findTopLevelEntityNames", () => {
    expect(findTopLevelEntityNames(parse(""))).toMatchInlineSnapshot("[]");
    expect(findTopLevelEntityNames(parse("test"))).toMatchInlineSnapshot("[]");
    expect(
      findTopLevelEntityNames(
        parse(
          `
        // Note: the following exports define entities that are not defined in the current file.
        // They should *not* appear in the output!
        export * as e1 from "./foo";
        export { default as e2, e3 } from "./bar";
        
        const Foo = 1, Fooo = 2;
        let Foooo = 3;
        var Fooooo = 4;

        {
          const Baz = 3;
        }
      
        export const Bar = 2;
        
        function f() {
          
        }

        export default function g() {
          
        }`
        )
      )
    ).toMatchInlineSnapshot(`
      [
        "Foo",
        "Fooo",
        "Foooo",
        "Fooooo",
        "Bar",
        "f",
        "g",
      ]
    `);
    expect(
      findTopLevelEntityNames(
        parse(`export const Foo = () => <div>children</div>;`)
      )
    ).toMatchInlineSnapshot(`
      [
        "Foo",
      ]
    `);
    expect(
      findTopLevelEntityNames(
        parse(
          `export const Foo = {
          args: {
            children: <div>children</div>
          }
        }`
        )
      )
    ).toMatchInlineSnapshot(`
      [
        "Foo",
      ]
    `);
  });
});

import { describe, expect, test } from "vitest";
import { findTopLevelEntityNames } from "./export-toplevel-plugin";

describe("exportToplevelPlugin", () => {
  test("findTopLevelEntityNames", () => {
    expect(findTopLevelEntityNames("")).toMatchInlineSnapshot("[]");
    expect(findTopLevelEntityNames("test")).toMatchInlineSnapshot("[]");
    expect(
      findTopLevelEntityNames(
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
        
        export default Qux;`
      )
    ).toMatchInlineSnapshot(`
      [
        "Foo",
        "Fooo",
        "Foooo",
        "Fooooo",
        "Bar",
        "f",
        "Qux",
      ]
    `);
    expect(
      findTopLevelEntityNames(`export const Foo = () => <div>children</div>;`)
    ).toMatchInlineSnapshot(`
      [
        "Foo",
      ]
    `);
    expect(
      findTopLevelEntityNames(
        `export const Foo = {
          args: {
            children: <div>children</div>
          }
        }`
      )
    ).toMatchInlineSnapshot(`
      [
        "Foo",
      ]
    `);
  });
});

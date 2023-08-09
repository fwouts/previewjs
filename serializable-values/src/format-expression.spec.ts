import { describe, expect, test } from "vitest";
import { formatExpression } from "./format-expression";

describe("formatExpression", () => {
  test("foo", async () => {
    expect(await formatExpression("(a, b) => 123")).toMatchInlineSnapshot(
      '"(a, b) => 123"'
    );
    expect(
      await formatExpression(`(a, b) => {
      return 123;
    }`)
    ).toMatchInlineSnapshot(`
      "(a, b) => {
        return 123;
      }"
    `);
    expect(
      await formatExpression(`
(a, b) => {
      return 123;
    }`)
    ).toMatchInlineSnapshot(`
      "(a, b) => {
        return 123;
      }"
    `);
    expect(await formatExpression(`<div>foo</div>`)).toMatchInlineSnapshot(
      '"<div>foo</div>"'
    );
    expect(await formatExpression(`<><div>foo</div></>`))
      .toMatchInlineSnapshot(`
        "<>
          <div>foo</div>
        </>"
      `);
    expect(await formatExpression(`<A><div>foo</div></A>`))
      .toMatchInlineSnapshot(`
        "<A>
          <div>foo</div>
        </A>"
      `);
  });
});

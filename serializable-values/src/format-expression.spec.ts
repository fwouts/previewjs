import { describe, expect, test } from "vitest";
import { formatExpression } from "./format-expression";

describe("formatExpression", () => {
  test("foo", () => {
    expect(formatExpression("(a, b) => 123")).toMatchInlineSnapshot(
      '"(a, b) => 123"'
    );
    expect(
      formatExpression(`(a, b) => {
      return 123;
    }`)
    ).toMatchInlineSnapshot(`
      "(a, b) => {
        return 123;
      }"
    `);
    expect(
      formatExpression(`
(a, b) => {
      return 123;
    }`)
    ).toMatchInlineSnapshot(`
      "(a, b) => {
        return 123;
      }"
    `);
    expect(formatExpression(`<div>foo</div>`)).toMatchInlineSnapshot(
      '"<div>foo</div>"'
    );
    expect(formatExpression(`<><div>foo</div></>`)).toMatchInlineSnapshot(`
      "<>
        <div>foo</div>
      </>"
    `);
    expect(formatExpression(`<A><div>foo</div></A>`)).toMatchInlineSnapshot(`
      "<A>
        <div>foo</div>
      </A>"
    `);
  });
});

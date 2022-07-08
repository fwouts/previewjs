import { describe, expect, it } from "vitest";
import { parseStories } from "./parser";

describe("parseStories", () => {
  it("detects title", () => {
    expect(
      parseStories(`
export default {
    title: "Hello World"
}
    `)
    ).toEqual({
      title: "Hello World",
    });
  });

  it("falls back to no title when default export without title", () => {
    expect(
      parseStories(`
export default {}
    `)
    ).toEqual({});
  });

  it("falls back to no title when no default export", () => {
    expect(
      parseStories(`
export default {}
    `)
    ).toEqual({});
  });
});

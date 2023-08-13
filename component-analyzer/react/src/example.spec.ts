import { describe, it } from "vitest";
import { createComponentAnalyzer } from ".";

describe("example", () => {
  it("shows how to use the API", async () => {
    const analyzer = createComponentAnalyzer({
      rootDir: __dirname,
    });
    const { components, stories } = await analyzer.detectComponents([]);
  });
});

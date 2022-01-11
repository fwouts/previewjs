import path from "path";
import { MemoryReader } from "./memory";

describe("MemoryReader", () => {
  it("reads null when empty", async () => {
    const memoryReader = new MemoryReader();
    expect(await memoryReader.read(path.join(__dirname, "foo"))).toBe(null);
  });

  it("reads nested paths when filled", async () => {
    const memoryReader = new MemoryReader();
    memoryReader.updateFile(path.join(__dirname, "foo"), "bar");
    memoryReader.updateFile(path.join(__dirname, "bar", "baz"), "qux");
    memoryReader.updateFile(path.join(__dirname, "bar", "qux"), "foo");
    expect(await memoryReader.read(__dirname)).toMatchObject({
      kind: "directory",
    });
    expect(await memoryReader.read(path.join(__dirname, "foo"))).toMatchObject({
      kind: "file",
    });
    expect(await memoryReader.read(path.join(__dirname, "bar"))).toMatchObject({
      kind: "directory",
    });
    expect(
      await memoryReader.read(path.join(__dirname, "bar", "baz"))
    ).toMatchObject({ kind: "file" });
    expect(
      await memoryReader.read(path.join(__dirname, "bar", "qux"))
    ).toMatchObject({ kind: "file" });
    expect(await memoryReader.read(path.join(__dirname, "baz"))).toBe(null);
  });
});

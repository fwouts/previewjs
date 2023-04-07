import { describe, expect, it } from "vitest";
import { MemoryReader } from "./memory";
import { StackedReader } from "./stacked";

describe.concurrent("StackedReader", () => {
  it("merges directories recursively (async)", async () => {
    const reader1 = new MemoryReader();
    const reader2 = new MemoryReader();
    const stackedReader = new StackedReader([reader1, reader2]);
    reader1.updateFile("/virtual/foo/bar/baz", "foo");
    reader2.updateFile("/virtual/foo/bar/qux", "bar");
    const fooDirEntry = await stackedReader.read("/virtual/foo");
    if (fooDirEntry?.kind !== "directory") {
      throw new Error(`Expected a directory, got ${fooDirEntry?.kind}`);
    }
    const fooDirChildren = await fooDirEntry.entries();
    expect(fooDirChildren.length).toBe(1);
    const [barDirEntry] = fooDirChildren;
    expect(barDirEntry?.name).toBe("bar");
    if (barDirEntry?.kind !== "directory") {
      throw new Error(`Expected a directory, got ${barDirEntry?.kind}`);
    }
    const barDirChildren = await barDirEntry.entries();
    expect(barDirChildren.length).toBe(2);
    expect(barDirChildren[0]?.name).toBe("baz");
    expect(barDirChildren[1]?.name).toBe("qux");
  });

  it("merges directories recursively (sync)", () => {
    const reader1 = new MemoryReader();
    const reader2 = new MemoryReader();
    const stackedReader = new StackedReader([reader1, reader2]);
    reader1.updateFile("/virtual/foo/bar/baz", "foo");
    reader2.updateFile("/virtual/foo/bar/qux", "bar");
    const fooDirEntry = stackedReader.readSync("/virtual/foo");
    if (fooDirEntry?.kind !== "directory") {
      throw new Error(`Expected a directory, got ${fooDirEntry?.kind}`);
    }
    const fooDirChildren = fooDirEntry.entries();
    expect(fooDirChildren.length).toBe(1);
    const [barDirEntry] = fooDirChildren;
    expect(barDirEntry?.name).toBe("bar");
    if (barDirEntry?.kind !== "directory") {
      throw new Error(`Expected a directory, got ${barDirEntry?.kind}`);
    }
    const barDirChildren = barDirEntry.entries();
    expect(barDirChildren.length).toBe(2);
    expect(barDirChildren[0]?.name).toBe("baz");
    expect(barDirChildren[1]?.name).toBe("qux");
  });
});

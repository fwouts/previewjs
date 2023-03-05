import fs from "fs-extra";
import os from "os";
import path from "path";
import { describe, expect, test } from "vitest";
import { findFiles } from "./find-files";

describe("find files", () => {
  test("ignores git-ignored files", async () => {
    const dirPath = path.join(os.tmpdir(), await fs.mkdtemp("find-files-test"));
    await fs.mkdirp(path.join(dirPath, ".git"));
    await fs.writeFile(
      path.join(dirPath, ".gitignore"),
      ["bar/qux/*", "baz/**/*", "b a r/qux/*"].join("\n"),
      "utf8"
    );
    await fs.writeFile(path.join(dirPath, "foo"), "", "utf8");
    await fs.mkdirp(path.join(dirPath, "bar", "qux"));
    await fs.mkdirp(path.join(dirPath, "baz", "qux"));
    await fs.mkdirp(path.join(dirPath, "b a r", "qux"));
    await fs.writeFile(path.join(dirPath, "foo"), "", "utf8");
    await fs.writeFile(path.join(dirPath, "bar", "foo"), "", "utf8");
    await fs.writeFile(path.join(dirPath, "bar", "qux", "foo"), "", "utf8");
    await fs.writeFile(path.join(dirPath, "baz", "foo"), "", "utf8");
    await fs.writeFile(path.join(dirPath, "baz", "qux", "foo"), "", "utf8");
    await fs.writeFile(path.join(dirPath, "b a r", "foo"), "", "utf8");
    await fs.writeFile(path.join(dirPath, "b a r", "qux", "foo"), "", "utf8");
    expect(await findFiles(dirPath, "**/*")).toEqual([
      path.join(path.join(dirPath, "foo")),
      path.join(path.join(dirPath, "b a r", "foo")),
      path.join(path.join(dirPath, "bar", "foo")),
    ]);
    expect(await findFiles(path.join(dirPath, "bar"), "**/*")).toEqual([
      path.join(path.join(dirPath, "bar", "foo")),
    ]);
    expect(await findFiles(path.join(dirPath, "b a r"), "**/*")).toEqual([
      path.join(path.join(dirPath, "b a r", "foo")),
    ]);
    await fs.rm(dirPath, {
      recursive: true,
    });
  });
});

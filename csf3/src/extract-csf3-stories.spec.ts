import ts from "typescript";
import { describe, expect, it } from "vitest";
import { extractCsf3Stories } from "./extract-csf3-stories";

describe("extractCsf3Stories", () => {
  it("detects CSF 3 stories", () => {
    expect(
      extract(`
export default {
  component: Button
}

export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}

export function NotStory() {}
    `)
    ).toMatchObject([
      {
        name: "Example",
        exported: true,
        isStory: true,
      },
      {
        name: "NoArgs",
        exported: true,
        isStory: true,
      },
    ]);
  });

  it("detects CSF 3 stories when export default uses cast", () => {
    expect(
      extract(`
export default {
  component: Button
} as ComponentMeta<typeof Button>;

export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}

export function NotStory() {}
    `)
    ).toMatchObject([
      {
        name: "Example",
        exported: true,
        isStory: true,
      },
      {
        name: "NoArgs",
        exported: true,
        isStory: true,
      },
    ]);
  });

  it("ignores objects that look like CSF 3 stories when default export doesn't have component", () => {
    expect(
      extract(`
export default {
  foo: "bar"
}

export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}
    `)
    ).toMatchObject([]);
  });

  it("ignores objects that look like CSF 3 stories when no default export", () => {
    expect(
      extract(`
export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}
    `)
    ).toMatchObject([]);
  });

  function extract(sourceCode: string) {
    const filePath = "/foo.tsx";
    const sourceFile = ts.createSourceFile(
      filePath,
      sourceCode,
      ts.ScriptTarget.Latest,
      true /* setParentNodes */,
      ts.ScriptKind.TSX
    );
    return extractCsf3Stories(filePath, sourceFile);
  }
});

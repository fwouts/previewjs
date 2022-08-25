import { createTypeAnalyzer, TypeAnalyzer } from "@previewjs/type-analyzer";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
  Reader,
  Writer,
} from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractCsf3Stories } from "./extract-csf3-stories";

const ROOT_DIR = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR, "App.stories.jsx");

describe("extractCsf3Stories", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath: ROOT_DIR,
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader({
          watch: false,
        }), // required for TypeScript libs, e.g. Promise
      ]),
    });
  });

  afterEach(() => {
    typeAnalyzer.dispose();
  });

  it("detects CSF 3 stories", () => {
    expect(
      extract(`
const Button = "foo";

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
        info: {
          kind: "story",
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
      {
        name: "NoArgs",
        info: {
          kind: "story",
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
    ]);
  });

  it("detects CSF 3 stories when export default uses cast", () => {
    expect(
      extract(`
const Button = "foo";

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
        info: {
          kind: "story",
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
      {
        name: "NoArgs",
        info: {
          kind: "story",
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
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
    memoryReader.updateFile(MAIN_FILE, sourceCode);
    const resolver = typeAnalyzer.analyze([MAIN_FILE]);
    const sourceFile = resolver.sourceFile(MAIN_FILE)!;
    return extractCsf3Stories(resolver.checker, MAIN_FILE, sourceFile);
  }
});

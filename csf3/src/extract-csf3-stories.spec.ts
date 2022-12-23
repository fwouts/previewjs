import { object, string, UNKNOWN } from "@previewjs/serializable-values";
import {
  createTypeAnalyzer,
  TypeAnalyzer,
  UNKNOWN_TYPE,
} from "@previewjs/type-analyzer";
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
const MAIN_FILE = path.join(ROOT_DIR, "App.tsx");
const STORIES_FILE = path.join(ROOT_DIR, "App.stories.jsx");

describe.concurrent("extractCsf3Stories", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(MAIN_FILE, "export const Button = 123;");
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
    memoryReader.updateFile(
      STORIES_FILE,
      `
import { Button } from "./App";

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
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        absoluteFilePath: STORIES_FILE,
        name: "Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
      {
        absoluteFilePath: STORIES_FILE,
        name: "NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
    ]);
  });

  it("resolves args to UNKNOWN when too complex", () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
import { Button } from "./App";

export default {
  component: Button
}

const label = "Hello, World!";

export const Example = {
  args: {
    label
  }
}
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        absoluteFilePath: STORIES_FILE,
        name: "Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("label"),
                value: UNKNOWN,
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
    ]);
  });

  it("detects CSF 3 stories when export default uses cast", () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
import { Button } from "./App";

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
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        absoluteFilePath: STORIES_FILE,
        name: "Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
      {
        absoluteFilePath: STORIES_FILE,
        name: "NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
    ]);
  });

  it("follows default imported component definition", () => {
    memoryReader.updateFile(MAIN_FILE, `export default "foo";`);
    memoryReader.updateFile(
      STORIES_FILE,
      `
import Button from "./App";

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
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        absoluteFilePath: STORIES_FILE,
        name: "Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "default",
          },
        },
      },
      {
        absoluteFilePath: STORIES_FILE,
        name: "NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "default",
          },
        },
      },
    ]);
  });

  it("follows wildcard re-exported component definition", () => {
    memoryReader.updateFile(MAIN_FILE, "export const Button = 123;");
    memoryReader.updateFile(
      path.join(ROOT_DIR, "reexport.ts"),
      `export * from "./App";`
    );
    memoryReader.updateFile(
      STORIES_FILE,
      `
import { Button } from "./reexport";

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
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        absoluteFilePath: STORIES_FILE,
        name: "Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
      {
        absoluteFilePath: STORIES_FILE,
        name: "NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
    ]);
  });

  it("follows named re-exported component definition", () => {
    memoryReader.updateFile(MAIN_FILE, "export const Button = 123;");
    memoryReader.updateFile(
      path.join(ROOT_DIR, "reexport.ts"),
      `export { Button as ReexportedButton } from "./App";`
    );
    memoryReader.updateFile(
      STORIES_FILE,
      `
import { ReexportedButton } from "./reexport";

export default {
  component: ReexportedButton
} as ComponentMeta<typeof ReexportedButton>;

export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}

export function NotStory() {}
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        absoluteFilePath: STORIES_FILE,
        name: "Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
      {
        absoluteFilePath: STORIES_FILE,
        name: "NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE,
            name: "Button",
          },
        },
      },
    ]);
  });

  it("ignores objects that look like CSF 3 stories when default export doesn't have component", () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
export default {
  foo: "bar"
}

export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([]);
  });

  it("ignores objects that look like CSF 3 stories when no default export", () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}
    `
    );

    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([]);
  });

  function extract(absoluteFilePath: string) {
    const resolver = typeAnalyzer.analyze([absoluteFilePath]);
    return extractCsf3Stories(
      resolver,
      resolver.sourceFile(absoluteFilePath)!,
      () =>
        Promise.resolve({
          propsType: UNKNOWN_TYPE,
          types: {},
        })
    );
  }
});

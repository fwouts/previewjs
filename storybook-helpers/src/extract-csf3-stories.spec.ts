import { object, string, UNKNOWN } from "@previewjs/serializable-values";
import type { TypeAnalyzer } from "@previewjs/type-analyzer";
import { createTypeAnalyzer, UNKNOWN_TYPE } from "@previewjs/type-analyzer";
import type { Reader, Writer } from "@previewjs/vfs";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { extractCsf3Stories } from "./extract-csf3-stories";

const ROOT_DIR = path.join(__dirname, "virtual");
const APP_TSX = path.join(ROOT_DIR, "App.tsx");
const APP_STORIES_JSX = path.join(ROOT_DIR, "App.stories.jsx");

describe("extractCsf3Stories", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(APP_TSX, "export const Button = 123;");
    typeAnalyzer = createTypeAnalyzer({
      rootDir: ROOT_DIR,
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

  it("detects CSF 3 stories", async () => {
    memoryReader.updateFile(
      APP_STORIES_JSX,
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

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.jsx:Example",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
      {
        id: "App.stories.jsx:NoArgs",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
    ]);
    expect(await extractedStories[0]?.extractArgs()).toMatchObject({
      value: object([
        {
          kind: "key",
          key: string("label"),
          value: string("Hello, World!"),
        },
      ]),
    });
    expect(await extractedStories[1]?.extractArgs()).toBeNull();
  });

  it("resolves args to UNKNOWN when too complex", async () => {
    memoryReader.updateFile(
      APP_STORIES_JSX,
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

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.jsx:Example",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
    ]);
    expect(await extractedStories[0]?.extractArgs()).toMatchObject({
      value: object([
        {
          kind: "key",
          key: string("label"),
          value: UNKNOWN,
        },
      ]),
    });
  });

  it("detects CSF 3 stories when export default uses cast", async () => {
    memoryReader.updateFile(
      APP_STORIES_JSX,
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

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.jsx:Example",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
      {
        id: "App.stories.jsx:NoArgs",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
    ]);
    expect(await extractedStories[0]?.extractArgs()).toMatchObject({
      value: object([
        {
          kind: "key",
          key: string("label"),
          value: string("Hello, World!"),
        },
      ]),
    });
    expect(await extractedStories[1]?.extractArgs()).toBeNull();
  });

  it("follows default imported component definition", async () => {
    memoryReader.updateFile(APP_TSX, `export default "foo";`);
    memoryReader.updateFile(
      APP_STORIES_JSX,
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

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.jsx:Example",
        associatedComponent: {
          id: "App.tsx:default",
        },
      },
      {
        id: "App.stories.jsx:NoArgs",
        associatedComponent: {
          id: "App.tsx:default",
        },
      },
    ]);
    expect(await extractedStories[0]?.extractArgs()).toMatchObject({
      value: object([
        {
          kind: "key",
          key: string("label"),
          value: string("Hello, World!"),
        },
      ]),
    });
    expect(await extractedStories[1]?.extractArgs()).toBeNull();
  });

  it("follows wildcard re-exported component definition", async () => {
    memoryReader.updateFile(APP_TSX, "export const Button = 123;");
    memoryReader.updateFile(
      path.join(ROOT_DIR, "reexport.ts"),
      `export * from "./App";`
    );
    memoryReader.updateFile(
      APP_STORIES_JSX,
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

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.jsx:Example",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
      {
        id: "App.stories.jsx:NoArgs",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
    ]);
    expect(await extractedStories[0]?.extractArgs()).toMatchObject({
      value: object([
        {
          kind: "key",
          key: string("label"),
          value: string("Hello, World!"),
        },
      ]),
    });
    expect(await extractedStories[1]?.extractArgs()).toBeNull();
  });

  it("follows named re-exported component definition", async () => {
    memoryReader.updateFile(APP_TSX, "export const Button = 123;");
    memoryReader.updateFile(
      path.join(ROOT_DIR, "reexport.ts"),
      `export { Button as ReexportedButton } from "./App";`
    );
    memoryReader.updateFile(
      APP_STORIES_JSX,
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

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.jsx:Example",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
      {
        id: "App.stories.jsx:NoArgs",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
    ]);
    expect(await extractedStories[0]?.extractArgs()).toMatchObject({
      value: object([
        {
          kind: "key",
          key: string("label"),
          value: string("Hello, World!"),
        },
      ]),
    });
    expect(await extractedStories[1]?.extractArgs()).toBeNull();
  });

  it("ignores objects that look like CSF 3 stories when default export doesn't have component", async () => {
    memoryReader.updateFile(
      APP_STORIES_JSX,
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

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([]);
  });

  it("ignores objects that look like CSF 3 stories when no default export", async () => {
    memoryReader.updateFile(
      APP_STORIES_JSX,
      `
export const Example = {
  args: {
    label: "Hello, World!"
  }
}

export const NoArgs = {}
    `
    );

    const extractedStories = await extract(APP_STORIES_JSX);
    expect(extractedStories).toMatchObject([]);
  });

  async function extract(absoluteFilePath: string) {
    const resolver = typeAnalyzer.analyze([absoluteFilePath]);
    return extractCsf3Stories(
      ROOT_DIR,
      resolver,
      resolver.sourceFile(absoluteFilePath)!,
      () =>
        Promise.resolve({
          props: UNKNOWN_TYPE,
          types: {},
        })
    );
  }
});

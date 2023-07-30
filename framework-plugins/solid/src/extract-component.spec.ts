import { object, string, TRUE } from "@previewjs/serializable-values";
import {
  objectType,
  STRING_TYPE,
  TypeAnalyzer,
} from "@previewjs/type-analyzer";
import type { Reader, Writer } from "@previewjs/vfs";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import path from "path";
import createLogger from "pino";
import prettyLogger from "pino-pretty";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import solidFrameworkPlugin from ".";
import { extractSolidComponents } from "./extract-component.js";

const ROOT_DIR = path.join(__dirname, "virtual");
const APP_TSX = path.join(ROOT_DIR, "App.tsx");
const APP_STORIES_TSX = path.join(ROOT_DIR, "App.stories.tsx");

describe("extractSolidComponents", () => {
  const logger = createLogger(
    { level: "debug" },
    prettyLogger({ colorize: true })
  );

  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(
      APP_TSX,
      "export const Button = ({ label }: { label: string }) => <div>{label}</div>;"
    );
    const frameworkPlugin = await solidFrameworkPlugin.create({
      rootDirPath: ROOT_DIR,
      dependencies: {},
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader({
          watch: false,
        }), // required for TypeScript libs, e.g. Promise
      ]),
      logger,
    });
    typeAnalyzer = frameworkPlugin.typeAnalyzer;
  });

  afterEach(() => {
    typeAnalyzer.dispose();
  });

  it("detects expected components", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
import type { Component } from 'solid-js';

const Component1: Component = () => {
  return <div>Hello, World!</div>;
};

const Component2 = () => {
  return <div>Hello, World!</div>;
};

function Component3() {
  return <div>Hello, World!</div>;
};

export const NotAStory = {
  args: {}
};

export default Component1;

`
    );
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:Component1",
        info: {
          kind: "component",
          exported: true,
        },
      },
      {
        componentId: "App.tsx:Component2",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        componentId: "App.tsx:Component3",
        info: {
          kind: "component",
          exported: false,
        },
      },
    ]);
  });

  it("detects components without any Solid import", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;
`
    );
    expect(extract(APP_TSX)).toMatchObject([
      {
        componentId: "App.tsx:DeclaredFunction",
        info: {
          kind: "component",
          exported: true,
        },
      },
      {
        componentId: "App.tsx:ConstantFunction",
        info: {
          kind: "component",
          exported: false,
        },
      },
    ]);
  });

  it("detects CSF1 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App";

export default {
  component: Button
}

export const Primary = () => <Button primary label="Button" />;

export const NotStory = (props) => <Button {...props} />;
`
    );

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Primary",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            componentId: "App.tsx:Button",
          },
        },
      },
      {
        componentId: "App.stories.tsx:NotStory",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
    const storyInfo = extractedStories[0]?.info;
    if (storyInfo?.kind !== "story" || !storyInfo.associatedComponent) {
      throw new Error();
    }
    expect(await storyInfo.associatedComponent.analyze()).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF1 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App";

export default {
  title: "Stories"
}

export const Primary = () => <Button primary label="Button" />;

export const NotStory = (props) => <Button {...props} />;
`
    );

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Primary",
        info: {
          kind: "story",
          args: null,
          associatedComponent: null,
        },
      },
      {
        componentId: "App.stories.tsx:NotStory",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects CSF2 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App";

export default {
  component: Button
}

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
   primary: true,
   label: 'Button',
};
`
    );

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Template",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        componentId: "App.stories.tsx:Primary",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                kind: "key",
                key: string("primary"),
                value: TRUE,
              },
              {
                kind: "key",
                key: string("label"),
                value: string("Button"),
              },
            ]),
          },
          associatedComponent: {
            componentId: "App.tsx:Button",
          },
        },
      },
    ]);
    const storyInfo = extractedStories[1]?.info;
    if (storyInfo?.kind !== "story" || !storyInfo.associatedComponent) {
      throw new Error();
    }
    expect(await storyInfo.associatedComponent.analyze()).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF2 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App";

export default {
  title: "Stories"
}

const Template = (args) => <Button {...args} />;

export const Primary = Template.bind({});
Primary.args = {
   primary: true,
   label: 'Button',
};
`
    );

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Template",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        componentId: "App.stories.tsx:Primary",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                kind: "key",
                key: string("primary"),
                value: TRUE,
              },
              {
                kind: "key",
                key: string("label"),
                value: string("Button"),
              },
            ]),
          },
          associatedComponent: null,
        },
      },
    ]);
  });

  it("detects CSF3 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
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

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                kind: "key",
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: {
            componentId: "App.tsx:Button",
          },
        },
      },
      {
        componentId: "App.stories.tsx:NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            componentId: "App.tsx:Button",
          },
        },
      },
    ]);
    const storyInfo = extractedStories[0]?.info;
    if (storyInfo?.kind !== "story" || !storyInfo.associatedComponent) {
      throw new Error();
    }
    expect(await storyInfo.associatedComponent.analyze()).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF3 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App";

export default {
  title: "Stories"
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

    const extractedStories = extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        componentId: "App.stories.tsx:Example",
        info: {
          kind: "story",
          args: {
            value: object([
              {
                kind: "key",
                key: string("label"),
                value: string("Hello, World!"),
              },
            ]),
          },
          associatedComponent: null,
        },
      },
      {
        componentId: "App.stories.tsx:NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: null,
        },
      },
    ]);
  });

  function extract(absoluteFilePath: string) {
    return extractSolidComponents(
      logger,
      typeAnalyzer.analyze([absoluteFilePath]),
      ROOT_DIR,
      absoluteFilePath
    );
  }
});

import type { Component, Story } from "@previewjs/analyzer-api";
import type { FrameworkPlugin } from "@previewjs/core";
import { TRUE, object, string } from "@previewjs/serializable-values";
import { STRING_TYPE, objectType } from "@previewjs/type-analyzer";
import type { Reader, Writer } from "@previewjs/vfs";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import path from "path";
import * as pino from "pino";
import PinoPretty from "pino-pretty";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crawlFile } from "./crawl-file.js";
import solidFrameworkPlugin from "./index.js";
const { pino: createLogger } = pino;
const { default: prettyLogger } = PinoPretty;

const ROOT_DIR = path.join(__dirname, "virtual");
const APP_TSX = path.join(ROOT_DIR, "App.tsx");
const APP_STORIES_TSX = path.join(ROOT_DIR, "App.stories.tsx");

function assertStory(story?: Story | Component): asserts story is Story {
  if (!story || !("associatedComponent" in story)) {
    throw new Error("Expected a story");
  }
}

describe("crawlFile", () => {
  const logger = createLogger(
    { level: "debug" },
    prettyLogger({ colorize: true })
  );

  let memoryReader: Reader & Writer;
  let frameworkPlugin: FrameworkPlugin;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(
      APP_TSX,
      "export const Button = ({ label }: { label: string }) => <div>{label}</div>;"
    );
    frameworkPlugin = await solidFrameworkPlugin.create({
      rootDir: ROOT_DIR,
      dependencies: {},
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader({
          watch: false,
        }), // required for TypeScript libs, e.g. Promise
      ]),
      logger,
    });
  });

  afterEach(() => {
    frameworkPlugin.dispose();
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
    expect(await extract(APP_TSX)).toMatchObject([
      {
        id: "App.tsx:Component1",
        exported: true,
      },
      {
        id: "App.tsx:Component2",
        exported: false,
      },
      {
        id: "App.tsx:Component3",
        exported: false,
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
    expect(await extract(APP_TSX)).toMatchObject([
      {
        id: "App.tsx:DeclaredFunction",
        exported: true,
      },
      {
        id: "App.tsx:ConstantFunction",
        exported: false,
      },
    ]);
  });

  it("detects CSF1 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App.js";

export default {
  component: Button
}

export const Primary = () => <Button primary label="Button" />;

export const NotStory = (props) => <Button {...props} />;
`
    );

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Primary",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
      {
        id: "App.stories.tsx:NotStory",
        exported: true,
      },
    ]);
    const story = extractedStories[0];
    assertStory(story);
    expect(await story.analyze()).toEqual({
      args: null,
    });
    expect(await story.associatedComponent?.analyze()).toEqual({
      props: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF1 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App.js";

export default {
  title: "Stories"
}

export const Primary = () => <Button primary label="Button" />;

export const NotStory = (props) => <Button {...props} />;
`
    );

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Primary",
        associatedComponent: null,
      },
      {
        id: "App.stories.tsx:NotStory",
        exported: true,
      },
    ]);
    const story = extractedStories[0];
    assertStory(story);
    expect(await story.analyze()).toEqual({
      args: null,
    });
  });

  it("detects CSF2 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App.js";

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

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Template",
        exported: false,
      },
      {
        id: "App.stories.tsx:Primary",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
    ]);
    const story = extractedStories[1];
    assertStory(story);
    expect(await story.analyze()).toMatchObject({
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
    });
    expect(await story.associatedComponent?.analyze()).toEqual({
      props: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF2 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App.js";

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

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Template",
        exported: false,
      },
      {
        id: "App.stories.tsx:Primary",
        associatedComponent: null,
      },
    ]);
    const story = extractedStories[1];
    assertStory(story);
    expect(await story.analyze()).toMatchObject({
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
    });
  });

  it("detects CSF3 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App.js";

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

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Example",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
      {
        id: "App.stories.tsx:NoArgs",
        associatedComponent: {
          id: "App.tsx:Button",
        },
      },
    ]);
    const [story1, story2] = extractedStories;
    assertStory(story1);
    assertStory(story2);
    expect(await story1.analyze()).toMatchObject({
      args: {
        value: object([
          {
            kind: "key",
            key: string("label"),
            value: string("Hello, World!"),
          },
        ]),
      },
    });
    expect(await story1.associatedComponent?.analyze()).toEqual({
      props: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
    expect(await story2.analyze()).toEqual({
      args: null,
    });
  });

  it("detects CSF3 stories (exported with title)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import { Button } from "./App.js";

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

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Example",
        associatedComponent: null,
      },
      {
        id: "App.stories.tsx:NoArgs",
        associatedComponent: null,
      },
    ]);
    const [story1, story2] = extractedStories;
    assertStory(story1);
    assertStory(story2);
    expect(await story1.analyze()).toMatchObject({
      args: {
        value: object([
          {
            kind: "key",
            key: string("label"),
            value: string("Hello, World!"),
          },
        ]),
      },
    });
    expect(await story2.analyze()).toEqual({
      args: null,
    });
  });

  function extract(absoluteFilePath: string) {
    return crawlFile(
      logger,
      frameworkPlugin.typeAnalyzer.analyze([absoluteFilePath]),
      ROOT_DIR,
      absoluteFilePath
    );
  }
});

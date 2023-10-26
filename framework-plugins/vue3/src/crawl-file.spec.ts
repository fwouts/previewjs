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
import { pino as createLogger } from "pino";
import { PinoPretty as prettyLogger } from "pino-pretty";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { crawlFile } from "./crawl-file.js";
import vue3FrameworkPlugin from "./index.js";
import { createVueTypeScriptReader } from "./vue-reader.js";

const ROOT_DIR = path.join(__dirname, "virtual");
const APP_TSX = path.join(ROOT_DIR, "App.tsx");
const MY_COMPONENT_VUE = path.join(ROOT_DIR, "MyComponent.vue");
const APP_STORIES_TSX = path.join(ROOT_DIR, "App.stories.tsx");

function assertStory(story?: Story | Component): asserts story is Story {
  if (!story || !("associatedComponent" in story)) {
    throw new Error("Expected a story");
  }
}

describe("crawlFile", () => {
  let memoryReader: Reader & Writer;
  let frameworkPlugin: FrameworkPlugin;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(
      MY_COMPONENT_VUE,
      `
<script setup lang="ts">
import { ref } from 'vue';

defineProps<{ label: string }>()

const count = ref(0)
</script>

<template>
  <div>
    {{ label }}
  </div>
</template>
`
    );
    const rootDir = path.join(__dirname, "virtual");
    const reader = createStackedReader([
      createVueTypeScriptReader(memoryReader),
      createFileSystemReader({
        mapping: {
          from: path.join(__dirname, "..", "preview", "modules"),
          to: path.join(rootDir, "node_modules"),
        },
        watch: false,
      }),
      createFileSystemReader({
        watch: false,
      }), // required for TypeScript libs, e.g. Promise
    ]);
    frameworkPlugin = await vue3FrameworkPlugin.create({
      rootDir,
      dependencies: {},
      reader,
      logger: createLogger(
        { level: "debug" },
        prettyLogger({ colorize: true })
      ),
    });
  });

  afterEach(() => {
    frameworkPlugin.dispose();
  });

  it("detects expected components", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
const Component1 = () => {
  return <div>Hello, World!</div>;
};

function Component2() {
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
    ]);
  });

  it("detects components without any Vue import", async () => {
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

  it("detects default export component (arrow function)", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export default () => {
  return <div>Hello, World!</div>;
}
`
    );
    expect(await extract(APP_TSX)).toMatchObject([
      {
        id: "App.tsx:default",
        exported: true,
      },
    ]);
  });

  it("detects default export component (named function)", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export default function test(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(await extract(APP_TSX)).toMatchObject([
      {
        id: "App.tsx:test",
        exported: true,
      },
    ]);
  });

  it("detects default export component (anonymous function)", async () => {
    memoryReader.updateFile(
      APP_TSX,
      `
export default function(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(await extract(APP_TSX)).toMatchObject([
      {
        id: "App.tsx:default",
        exported: true,
      },
    ]);
  });

  it("detects CSF1 stories (exported with component)", async () => {
    memoryReader.updateFile(
      APP_STORIES_TSX,
      `
import Button from "./MyComponent.vue.js";

export default {
  component: Button
}

export const Primary = () => ({
  components: { Button },
  template: '<Button primary label="Button" />',
});
`
    );

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Primary",
        associatedComponent: {
          id: "MyComponent.vue:MyComponent",
        },
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
import Button from "./MyComponent.vue.js";

export default {
  title: "Stories"
}

export const Primary = () => ({
  components: { Button },
  template: '<Button primary label="Button" />',
});
`
    );

    const extractedStories = await extract(APP_STORIES_TSX);
    expect(extractedStories).toMatchObject([
      {
        id: "App.stories.tsx:Primary",
        associatedComponent: null,
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
import Button from "./MyComponent.vue.js";

export default {
  component: Button
}

const Template = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});

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
        id: "App.stories.tsx:Primary",
        associatedComponent: {
          id: "MyComponent.vue:MyComponent",
        },
      },
    ]);
    const story = extractedStories[0];
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
import Button from "./MyComponent.vue.js";

export default {
  title: "Stories"
}

const Template = (args) => ({
  components: { Button },
  setup() {
    return { args };
  },
  template: '<Button v-bind="args" />',
});

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
        id: "App.stories.tsx:Primary",
        associatedComponent: null,
      },
    ]);
    const story = extractedStories[0];
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
import Button from './MyComponent.vue';

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
          id: "MyComponent.vue:MyComponent",
        },
      },
      {
        id: "App.stories.tsx:NoArgs",
        associatedComponent: {
          id: "MyComponent.vue:MyComponent",
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
import Button from './MyComponent.vue';

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
      memoryReader,
      frameworkPlugin.typeAnalyzer.analyze([absoluteFilePath]),
      ROOT_DIR,
      absoluteFilePath
    );
  }
});

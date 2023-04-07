import { object, string, TRUE } from "@previewjs/serializable-values";
import {
  createTypeAnalyzer,
  objectType,
  STRING_TYPE,
  TypeAnalyzer,
} from "@previewjs/type-analyzer";
import {
  createFileSystemReader,
  createMemoryReader,
  createStackedReader,
} from "@previewjs/vfs";
import type { Reader, Writer } from "@previewjs/vfs";
import path from "path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import vue3FrameworkPlugin from ".";
import { extractVueComponents } from "./extract-component.js";
import { createVueTypeScriptReader } from "./vue-reader";

const ROOT_DIR = path.join(__dirname, "virtual");
const MAIN_FILE_TSX = path.join(ROOT_DIR, "App.tsx");
const MAIN_FILE_VUE = path.join(ROOT_DIR, "MyComponent.vue");
const STORIES_FILE = path.join(ROOT_DIR, "App.stories.tsx");

describe.concurrent("extractVueComponents", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(
      MAIN_FILE_VUE,
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
    const rootDirPath = path.join(__dirname, "virtual");
    const frameworkPlugin = await vue3FrameworkPlugin.create({
      rootDirPath,
      dependencies: {},
    });
    const reader = createStackedReader([
      createVueTypeScriptReader(memoryReader),
      createFileSystemReader({
        mapping: {
          from: path.join(__dirname, "..", "preview", "modules"),
          to: path.join(rootDirPath, "node_modules"),
        },
        watch: false,
      }),
      createFileSystemReader({
        watch: false,
      }), // required for TypeScript libs, e.g. Promise
    ]);
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath,
      reader,
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    });
  });

  afterEach(() => {
    typeAnalyzer.dispose();
  });

  it("detects expected components", async () => {
    memoryReader.updateFile(
      MAIN_FILE_TSX,
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
    expect(extract(MAIN_FILE_TSX)).toMatchObject([
      {
        name: "Component1",
        info: {
          kind: "component",
          exported: true,
        },
      },
      {
        name: "Component2",
        info: {
          kind: "component",
          exported: false,
        },
      },
    ]);
  });

  it("detects components without any Vue import", async () => {
    memoryReader.updateFile(
      MAIN_FILE_TSX,
      `
export function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;
`
    );
    expect(extract(MAIN_FILE_TSX)).toMatchObject([
      {
        name: "DeclaredFunction",
        info: {
          kind: "component",
          exported: true,
        },
      },
      {
        name: "ConstantFunction",
        info: {
          kind: "component",
          exported: false,
        },
      },
    ]);
  });

  it("detects default export component (arrow function)", async () => {
    memoryReader.updateFile(
      MAIN_FILE_TSX,
      `
export default () => {
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(MAIN_FILE_TSX)).toMatchObject([
      {
        name: "default",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects default export component (named function)", async () => {
    memoryReader.updateFile(
      MAIN_FILE_TSX,
      `
export default function test(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(MAIN_FILE_TSX)).toMatchObject([
      {
        name: "test",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects default export component (anonymous function)", async () => {
    memoryReader.updateFile(
      MAIN_FILE_TSX,
      `
export default function(){
  return <div>Hello, World!</div>;
}
`
    );
    expect(extract(MAIN_FILE_TSX)).toMatchObject([
      {
        name: "default",
        info: {
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects CSF1 stories", async () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
import Button from './MyComponent.vue';

export default {
  component: Button
}

export const Primary = () => ({
  components: { Button },
  template: '<Button primary label="Button" />',
});
`
    );
    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        name: "Primary",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE_VUE,
            name: "MyComponent",
          },
        },
      },
    ]);
    if (extractedStories[0]?.info.kind !== "story") {
      throw new Error();
    }
    expect(
      await extractedStories[0].info.associatedComponent.analyze()
    ).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF2 stories", async () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
import Button from './MyComponent.vue';

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
    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        name: "Primary",
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
            absoluteFilePath: MAIN_FILE_VUE,
            name: "MyComponent",
          },
        },
      },
    ]);
    if (extractedStories[0]?.info.kind !== "story") {
      throw new Error();
    }
    expect(
      await extractedStories[0].info.associatedComponent.analyze()
    ).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  it("detects CSF3 stories", async () => {
    memoryReader.updateFile(
      STORIES_FILE,
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
    const extractedStories = extract(STORIES_FILE);
    expect(extractedStories).toMatchObject([
      {
        name: "Example",
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
            absoluteFilePath: MAIN_FILE_VUE,
            name: "MyComponent",
          },
        },
      },
      {
        name: "NoArgs",
        info: {
          kind: "story",
          args: null,
          associatedComponent: {
            absoluteFilePath: MAIN_FILE_VUE,
            name: "MyComponent",
          },
        },
      },
    ]);
    if (extractedStories[0]?.info.kind !== "story") {
      throw new Error();
    }
    expect(
      await extractedStories[0].info.associatedComponent.analyze()
    ).toEqual({
      propsType: objectType({
        label: STRING_TYPE,
      }),
      types: {},
    });
  });

  function extract(absoluteFilePath: string) {
    return extractVueComponents(
      memoryReader,
      typeAnalyzer.analyze([absoluteFilePath]),
      absoluteFilePath
    );
  }
});

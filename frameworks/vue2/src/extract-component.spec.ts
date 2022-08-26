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
import { vue2FrameworkPlugin } from ".";
import { extractVueComponents } from "./extract-component";
import { createVueTypeScriptReader } from "./vue-reader";

const ROOT_DIR = path.join(__dirname, "virtual");
const MAIN_FILE_TSX = path.join(ROOT_DIR, "App.tsx");
const MAIN_FILE_VUE = path.join(ROOT_DIR, "MyComponent.vue");
const STORIES_FILE = path.join(ROOT_DIR, "App.stories.tsx");

describe("extractVueComponents", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    memoryReader.updateFile(
      MAIN_FILE_VUE,
      `
<template>
  <div>
    Hello, World!
  </div>
</template>

<script>
export default {
  name: "App",
};
</script>
`
    );
    const frameworkPlugin = await vue2FrameworkPlugin.create();
    const rootDirPath = path.join(__dirname, "virtual");
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
import Button from "./MyComponent.vue";

export default {
  component: Button
}

export const Primary = () => ({
  components: { Button },
  template: '<Button primary label="Button" />',
});
`
    );
    expect(extract(STORIES_FILE)).toMatchObject([
      {
        name: "Primary",
        info: {
          // TODO: this should be "story".
          kind: "component",
          exported: true,
        },
      },
    ]);
  });

  it("detects CSF2 stories", async () => {
    memoryReader.updateFile(
      STORIES_FILE,
      `
import Button from "./MyComponent.vue";

export default {
  component: Button
}

const Template = (args, { argTypes }) => ({
  props: Object.keys(argTypes),
  components: { Button },
});

export const Primary = Template.bind({});

Primary.args = {
  primary: true,
  label: 'Button',
};
`
    );
    expect(extract(STORIES_FILE)).toMatchObject([
      {
        name: "Primary",
        info: {
          kind: "story",
          associatedComponent: {
            absoluteFilePath: MAIN_FILE_VUE,
            name: "MyComponent",
          },
        },
      },
    ]);
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
    expect(extract(STORIES_FILE)).toMatchObject([
      {
        name: "Example",
        info: {
          kind: "story",
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
          associatedComponent: {
            absoluteFilePath: MAIN_FILE_VUE,
            name: "MyComponent",
          },
        },
      },
    ]);
  });

  function extract(absoluteFilePath: string) {
    return extractVueComponents(
      typeAnalyzer.analyze([absoluteFilePath]),
      absoluteFilePath
    );
  }
});

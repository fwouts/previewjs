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
import solidFrameworkPlugin from ".";
import { extractSolidComponents } from "./extract-component";

const ROOT_DIR = path.join(__dirname, "virtual");
const MAIN_FILE = path.join(ROOT_DIR, "App.tsx");
const STORIES_FILE = path.join(ROOT_DIR, "App.stories.tsx");

describe.concurrent("extractSolidComponents", () => {
  let memoryReader: Reader & Writer;
  let typeAnalyzer: TypeAnalyzer;

  beforeEach(async () => {
    memoryReader = createMemoryReader();
    const frameworkPlugin = await solidFrameworkPlugin.create();
    typeAnalyzer = createTypeAnalyzer({
      rootDirPath: ROOT_DIR,
      reader: createStackedReader([
        memoryReader,
        createFileSystemReader({
          watch: false,
        }), // required for TypeScript libs, e.g. Promise
      ]),
      tsCompilerOptions: frameworkPlugin.tsCompilerOptions,
    });
  });

  afterEach(() => {
    typeAnalyzer.dispose();
  });

  it("detects expected components", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
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
    expect(extract(MAIN_FILE)).toMatchObject([
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
      {
        name: "Component3",
        info: {
          kind: "component",
          exported: false,
        },
      },
    ]);
  });

  it("detects components without any Solid import", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
export function DeclaredFunction() {
  return <div>Hello, World!</div>;
}

const ConstantFunction = () => <div>Hello, World!</div>;
`
    );
    expect(extract(MAIN_FILE)).toMatchObject([
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

  it("detects CSF2 stories", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
export function Button() {
  return <div>Hello, World!</div>;
}
`
    );
    memoryReader.updateFile(
      STORIES_FILE,
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
    expect(extract(STORIES_FILE)).toMatchObject([
      {
        name: "Template",
        info: {
          kind: "component",
          exported: false,
        },
      },
      {
        name: "Primary",
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

  it("detects CSF3 stories", async () => {
    memoryReader.updateFile(
      MAIN_FILE,
      `
export function Button() {
  return <div>Hello, World!</div>;
}
`
    );
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
    expect(extract(STORIES_FILE)).toMatchObject([
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

  function extract(absoluteFilePath: string) {
    return extractSolidComponents(
      typeAnalyzer.analyze([absoluteFilePath]),
      absoluteFilePath
    );
  }
});
